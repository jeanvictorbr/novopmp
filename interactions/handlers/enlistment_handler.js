const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { getEnlistmentMenuPayload, getQuizHubPayload, getQuizManagementPayload } = require('../../views/setup_views.js');

// Mapa para armazenar o estado das provas dos usuários (a ser usado no futuro)
const userQuizStates = new Map();

const enlistmentHandler = {
    customId: (id) => id.startsWith('enlistment_') || id.startsWith('quiz_') || id === 'delete_cancel',

    async execute(interaction) {
        try {
            const { customId } = interaction;

            if (customId === 'delete_cancel') {
                return await interaction.update({ content: 'Ação cancelada.', components: [], embeds: [] }).catch(() => {});
            }
            
            // --- ROTAS DE CONFIGURAÇÃO (/setup) ---
            if (customId.startsWith('enlistment_setup_')) return this.handleSetup(interaction);
            if (customId.startsWith('quiz_admin_')) return this.handleQuizAdmin(interaction);

            // --- ROTAS PÚBLICAS (CANDIDATO) ---
            if (customId === 'enlistment_start_process') return this.handleStartProcess(interaction);
            if (customId === 'quiz_public_start') return this.startQuiz(interaction);
            if (customId.startsWith('quiz_answer_')) return this.handleQuizAnswer(interaction);

            // --- ROTAS DE RECRUTADOR ---
            if (customId.startsWith('enlistment_approve_') || customId.startsWith('enlistment_reject_')) return this.handleApproval(interaction);
            
            // --- MODALS (FORMULÁRIOS) ---
            if (interaction.isModalSubmit()) {
                if (customId === 'quiz_admin_create_modal') return this.handleCreateQuizModal(interaction);
                if (customId.startsWith('quiz_admin_add_question_modal_')) return this.handleAddQuestionModal(interaction);
                if (customId.startsWith('quiz_admin_edit_question_modal_')) return this.handleEditQuestionModal(interaction);
                if (customId === 'enlistment_apply_modal') return this.handleEnlistmentModal(interaction);
            }
        } catch (error) {
            console.error("Erro geral ao processar interação:", error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: '❌ Houve um erro crítico ao processar esta ação.', ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ content: '❌ Houve um erro crítico ao processar esta ação.', ephemeral: true }).catch(() => {});
            }
        }
    },

    //==================================
    // LÓGICA DE CONFIGURAÇÃO (ADMIN)
    //==================================
    async handleSetup(interaction) {
        const action = interaction.customId.split('_').slice(2).join('_');
        
        if (action === 'manage_quizzes') {
            const payload = await getQuizHubPayload(db);
            return await interaction.update(payload);
        }

        const configMap = {
            'set_form_channel': { type: 'channel', dbKey: 'enlistment_form_channel_id', placeholder: 'Selecione o Canal de Alistamento' },
            'set_approval_channel': { type: 'channel', dbKey: 'enlistment_approval_channel_id', placeholder: 'Selecione o Canal de Aprovações' },
            'set_quiz_passed_role': { type: 'role', dbKey: 'enlistment_quiz_passed_role_id', placeholder: 'Selecione o Cargo Pós-Prova' },
            'set_recruit_role': { type: 'role', dbKey: 'enlistment_recruit_role_id', placeholder: 'Selecione o Cargo de Recruta (Final)' },
            'set_recruiter_role': { type: 'role', dbKey: 'recruiter_role_id', placeholder: 'Selecione o Cargo de Recrutador' }
        };

        if (configMap[action]) {
            const config = configMap[action];
            const builder = config.type === 'channel' ? new ChannelSelectMenuBuilder() : new RoleSelectMenuBuilder();
            const menu = new ActionRowBuilder().addComponents(builder.setCustomId(`enlistment_setup_save_${config.dbKey}`).setPlaceholder(config.placeholder));
            await interaction.reply({ content: 'Selecione uma opção no menu.', components: [menu], ephemeral: true });
        } else if (action.startsWith('save_')) {
            const dbKey = action.replace('save_', '');
            await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [dbKey, interaction.values[0]]);
            const payload = await getEnlistmentMenuPayload(db);
            await interaction.update(payload);
        }
    },

    async handleQuizAdmin(interaction) {
        const { customId } = interaction;
        const parts = customId.split('_');
        const action = parts[2];

        // Rota para Menus de Seleção
        if (interaction.isStringSelectMenu()) {
            if (action === 'select' && parts[3] === 'action') {
                await interaction.deferUpdate();
                const selectedValue = interaction.values[0];
                if (selectedValue === 'quiz_admin_deactivate') {
                    await db.run("DELETE FROM settings WHERE key = 'enlistment_quiz_id'");
                    const payload = await getQuizHubPayload(db);
                    await interaction.editReply(payload);
                } else if (selectedValue.startsWith('quiz_admin_select_')) {
                    const selectedQuizId = selectedValue.split('_').pop();
                    const payload = await getQuizManagementPayload(db, selectedQuizId);
                    await interaction.editReply(payload);
                }
            } else if (customId === 'quiz_admin_select_question_to_manage') {
                await interaction.deferUpdate();
                const [selectedQuizId, questionIndex] = interaction.values[0].split('_');
                const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [selectedQuizId]);
                const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
                const question = questions[questionIndex];

                if (!question) {
                    return interaction.editReply({ content: '❌ A pergunta selecionada não foi encontrada.', components: [] });
                }

                const embed = new EmbedBuilder().setColor("Yellow").setTitle(`Gerindo Pergunta #${parseInt(questionIndex, 10) + 1}`).setDescription(question.question);
                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`quiz_admin_open_edit_modal_${selectedQuizId}_${questionIndex}`).setLabel("Editar Pergunta").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`quiz_admin_delete_question_${selectedQuizId}_${questionIndex}`).setLabel("Apagar Pergunta").setStyle(ButtonStyle.Danger)
                );
                await interaction.editReply({ embeds: [embed], components: [buttons] });
            }
            return;
        }

        // Rota para Cliques de Botão
        if (interaction.isButton()) {
            if (action === 'create' && parts[3] === 'new') {
                const modal = new ModalBuilder().setCustomId('quiz_admin_create_modal').setTitle('Criar Nova Prova');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quiz_title').setLabel("Título da Prova").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quiz_passing_score').setLabel("Nota Mínima para Aprovação (%)").setStyle(TextInputStyle.Short).setRequired(true))
                );
                return await interaction.showModal(modal);
            } else if (action === 'back' && parts[3] === 'to' && parts[4] === 'enlistment') {
                const payload = await getEnlistmentMenuPayload(db);
                return await interaction.update(payload);
            } else if (action === 'activate') {
                await interaction.deferUpdate();
                await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['enlistment_quiz_id', parts[3]]);
                const payload = await getQuizManagementPayload(db, parts[3]);
                return await interaction.editReply(payload);
            } else if (action === 'add' && parts[3] === 'question') {
                const modal = new ModalBuilder().setCustomId(`quiz_admin_add_question_modal_${parts[4]}`).setTitle('Adicionar Nova Pergunta');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('question_text').setLabel("Enunciado da Pergunta").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('options').setLabel("Alternativas (uma por linha)").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('correct_answer').setLabel("Letra da Alternativa Correta (A, B, C...)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1))
                );
                return await interaction.showModal(modal);
            } else if (action === 'edit' && parts[3] === 'question') {
                const quizId = parts[4];
                const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
                const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
                if (questions.length === 0) return interaction.reply({ content: 'Não há perguntas para editar.', ephemeral: true });
                const options = questions.map((q, index) => ({ label: `Pergunta #${index + 1}: ${q.question.substring(0, 80)}`, value: `${quizId}_${index}` }));
                const selectMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('quiz_admin_select_question_to_manage').setPlaceholder('Selecione uma pergunta...').addOptions(options));
                return await interaction.reply({ content: 'Selecione uma pergunta para gerir:', components: [selectMenu], ephemeral: true });
            } else if (action === 'open' && parts[3] === 'edit' && parts[4] === 'modal') {
                const [,,,, selectedQuizId, questionIndex] = parts;
                const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [selectedQuizId]);
                const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
                const questionData = questions[questionIndex];
                if (!questionData) {
                    return interaction.reply({ content: '❌ A pergunta selecionada não foi encontrada.', ephemeral: true });
                }
                const modal = new ModalBuilder().setCustomId(`quiz_admin_edit_question_modal_${selectedQuizId}_${questionIndex}`).setTitle(`Editando Pergunta #${parseInt(questionIndex, 10) + 1}`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('question_text').setLabel("Enunciado").setStyle(TextInputStyle.Paragraph).setValue(questionData.question).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('options').setLabel("Alternativas").setStyle(TextInputStyle.Paragraph).setValue(questionData.options.join('\n')).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('correct_answer').setLabel("Letra Correta").setStyle(TextInputStyle.Short).setValue(questionData.correct).setRequired(true).setMaxLength(1))
                );
                return await interaction.showModal(modal);
            } else if (action === 'delete' && parts[3] === 'question') {
                await interaction.deferUpdate();
                const [,,,, selectedQuizId, questionIndex] = parts;
                const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [selectedQuizId]);
                const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
                questions.splice(questionIndex, 1);
                await db.run('UPDATE enlistment_quizzes SET questions = $1 WHERE quiz_id = $2', [JSON.stringify(questions), selectedQuizId]);
                
                const payload = await getQuizManagementPayload(db, selectedQuizId);
                return await interaction.editReply(payload);
            } else if (action === 'delete' && parts[3] === 'quiz') {
                const confirmButton = new ButtonBuilder().setCustomId(`quiz_admin_delete_confirm_${parts[4]}`).setLabel('Sim, Apagar Prova').setStyle(ButtonStyle.Danger);
                const cancelButton = new ButtonBuilder().setCustomId('delete_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary);
                const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
                return await interaction.reply({ content: `⚠️ **Atenção!** Deseja apagar esta prova permanentemente?`, components: [row], ephemeral: true });
            } else if (action === 'delete' && parts[3] === 'confirm') {
                await interaction.deferUpdate();
                const quizIdToDelete = parts[4];
                await db.run('DELETE FROM enlistment_quizzes WHERE quiz_id = $1', [quizIdToDelete]);
                await db.run("DELETE FROM settings WHERE key = 'enlistment_quiz_id' AND value = $1", [quizIdToDelete]);
                const payload = await getQuizHubPayload(db);
                return await interaction.editReply(payload);
            }
        }
    },
    
    async handleCreateQuizModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const title = interaction.fields.getTextInputValue('quiz_title');
        const passingScore = parseInt(interaction.fields.getTextInputValue('quiz_passing_score'), 10);

        if (isNaN(passingScore) || passingScore < 0 || passingScore > 100) {
            return await interaction.editReply({ content: '❌ A nota mínima deve ser um número entre 0 e 100.' });
        }
        await db.run('INSERT INTO enlistment_quizzes (title, passing_score, questions) VALUES ($1, $2, $3)', [title, passingScore, '[]']);
        
        await interaction.editReply({ content: `✅ Prova "${title}" criada com sucesso! O painel será atualizado quando você voltar.` });
    },

    async handleAddQuestionModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const quizId = interaction.customId.split('_').pop();
        
        try {
            const questionText = interaction.fields.getTextInputValue('question_text');
            const optionsText = interaction.fields.getTextInputValue('options');
            const correctAnswerLetter = interaction.fields.getTextInputValue('correct_answer').toUpperCase();
            const options = optionsText.split('\n').filter(opt => opt.trim() !== '');

            if (options.length < 2) {
                return await interaction.editReply({ content: '❌ Pelo menos duas alternativas são necessárias.' });
            }

            const correctIndex = correctAnswerLetter.charCodeAt(0) - 65;
            if (correctIndex < 0 || correctIndex >= options.length) {
                return await interaction.editReply({ content: `❌ A resposta correta ('${correctAnswerLetter}') é inválida para as opções fornecidas.` });
            }
            
            const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);

            if (!quiz) {
                console.error(`[QUIZ DEBUG] CRITICAL: Prova com ID ${quizId} não foi encontrada no DB ao adicionar pergunta.`);
                return await interaction.editReply({ content: '❌ Erro crítico: A prova para esta pergunta não foi encontrada.' });
            }

            const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
            const newQuestion = { question: questionText, options: options, correct: correctAnswerLetter };
            questions.push(newQuestion);
            
            await db.run(
                'UPDATE enlistment_quizzes SET questions = $1 WHERE quiz_id = $2', 
                [JSON.stringify(questions), quizId]
            );

            await interaction.editReply({ content: '✅ Pergunta adicionada com sucesso! O painel será atualizado da próxima vez que você o visualizar.' });

        } catch (error) {
            console.error("Erro CRÍTICO em handleAddQuestionModal:", error);
            await interaction.editReply({ content: '❌ Ocorreu um erro inesperado ao salvar a pergunta. Verifique os logs do console.' }).catch(e => console.error("Falha ao enviar mensagem de erro:", e));
        }
    },

    async handleEditQuestionModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const [,,, quizId, questionIndex] = interaction.customId.split('_');
        try {
            const questionText = interaction.fields.getTextInputValue('question_text');
            const optionsText = interaction.fields.getTextInputValue('options');
            const correctAnswerLetter = interaction.fields.getTextInputValue('correct_answer').toUpperCase();
            const options = optionsText.split('\n').filter(opt => opt.trim() !== '');

            if (options.length < 2) {
                return await interaction.editReply({ content: '❌ Pelo menos duas alternativas são necessárias.' });
            }
            const correctIndex = correctAnswerLetter.charCodeAt(0) - 65;
            if (correctIndex < 0 || correctIndex >= options.length) {
                return await interaction.editReply({ content: `❌ A resposta correta ('${correctAnswerLetter}') é inválida.` });
            }

            const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
            if (!quiz) {
                 return await interaction.editReply({ content: '❌ Erro crítico: A prova para esta pergunta não foi encontrada.' });
            }
            
            const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
            const updatedQuestion = { question: questionText, options: options, correct: correctAnswerLetter };
            
            if(questionIndex >= questions.length){
                 return await interaction.editReply({ content: '❌ Erro crítico: O índice da pergunta é inválido.' });
            }
            questions[questionIndex] = updatedQuestion;
            
            await db.run('UPDATE enlistment_quizzes SET questions = $1 WHERE quiz_id = $2', [JSON.stringify(questions), quizId]);
            
            await interaction.editReply({ content: `✅ Pergunta #${parseInt(questionIndex, 10) + 1} atualizada! O painel será atualizado da próxima vez que você o visualizar.` });
        } catch (error) {
            console.error("Erro ao editar pergunta:", error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao salvar as alterações.' });
        }
    },

    //==================================
    // LÓGICA PÚBLICA (CANDIDATO)
    //==================================
    async handleStartProcess(interaction) {
        const activeQuizId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_id'"))?.value;
        const quizPassedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;

        if (activeQuizId && quizPassedRoleId && !interaction.member.roles.cache.has(quizPassedRoleId)) {
            return interaction.reply({ content: '❌ Para se alistar, você precisa primeiro ser aprovado na Prova Teórica.', ephemeral: true });
        }
        
        const existingRequest = await db.get('SELECT 1 FROM enlistment_requests WHERE user_id = $1 AND status = $2', [interaction.user.id, 'pending']);
        if (existingRequest) {
            return interaction.reply({ content: '❌ Você já possui uma ficha em análise.', ephemeral: true });
        }

        const modal = new ModalBuilder().setCustomId('enlistment_apply_modal').setTitle('Formulário de Alistamento');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rp_name').setLabel("Nome Completo (RP)").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('game_id').setLabel("Seu ID (no jogo)").setStyle(TextInputStyle.Short).setRequired(true))
        );
        await interaction.showModal(modal);
    },

    async handleEnlistmentModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const rpName = interaction.fields.getTextInputValue('rp_name');
        const gameId = interaction.fields.getTextInputValue('game_id');
        
        const approvalChannelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_approval_channel_id'"))?.value;
        const recruiterRoleId = (await db.get("SELECT value FROM settings WHERE key = 'recruiter_role_id'"))?.value;

        if (!approvalChannelId || !recruiterRoleId) {
            return interaction.editReply({ content: '❌ O sistema de alistamento não está configurado.' });
        }

        const result = await db.run('INSERT INTO enlistment_requests (user_id, rp_name, game_id, request_date, status) VALUES ($1, $2, $3, $4, $5) RETURNING request_id', [interaction.user.id, rpName, gameId, Math.floor(Date.now() / 1000), 'pending']);
        const requestId = result.rows[0].request_id;
        
        const channel = await interaction.guild.channels.fetch(approvalChannelId);
        const embed = new EmbedBuilder().setColor('Yellow').setTitle('📝 Nova Ficha para Análise').setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .addFields({ name: 'Candidato', value: interaction.user.toString() }, { name: 'Nome (RP)', value: `\`${rpName}\`` }, { name: 'ID (Jogo)', value: `\`${gameId}\`` });
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`enlistment_approve_${requestId}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`enlistment_reject_${requestId}`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
        );
        await channel.send({ content: `Atenção, <@&${recruiterRoleId}>!`, embeds: [embed], components: [buttons] });
        
        await interaction.editReply({ content: '✅ A sua ficha foi enviada para análise!' });
    },
    
    async startQuiz(interaction) {
        return interaction.reply({ content: 'Início da prova em construção.', ephemeral: true });
    },
    async handleQuizAnswer(interaction) {
         return interaction.reply({ content: 'Resposta da prova em construção.', ephemeral: true });
    },

    //==================================
    // LÓGICA DO RECRUTADOR
    //==================================
    async handleApproval(interaction) {
        await interaction.deferUpdate();
        const [action, requestId] = interaction.customId.replace('enlistment_', '').split('_');
        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        const request = await db.get('SELECT * FROM enlistment_requests WHERE request_id = $1', [requestId]);
        if (!request || request.status !== 'pending') {
            return;
        }

        const candidate = await interaction.guild.members.fetch(request.user_id).catch(() => null);
        if (!candidate) {
            await db.run('DELETE FROM enlistment_requests WHERE request_id = $1', [requestId]);
            return interaction.message.edit({ content: 'Candidato não encontrado. Ficha removida.', components: [], embeds: [] });
        }

        await db.run('UPDATE enlistment_requests SET status = $1, recruiter_id = $2 WHERE request_id = $3', [newStatus, interaction.user.id, requestId]);

        const quizPassedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;
        const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;
        
        let dmEmbed;
        if (newStatus === 'approved') {
            if (quizPassedRoleId) await candidate.roles.remove(quizPassedRoleId).catch(console.error);
            if (recruitRoleId) await candidate.roles.add(recruitRoleId).catch(console.error);
            dmEmbed = new EmbedBuilder().setColor('Green').setTitle('🎉 Alistamento Aprovado!').setDescription('Parabéns! Sua ficha foi aprovada.');
        } else {
            if (quizPassedRoleId) await candidate.roles.remove(quizPassedRoleId).catch(console.error);
            dmEmbed = new EmbedBuilder().setColor('Red').setTitle('❌ Alistamento Recusado').setDescription('Sua ficha foi recusada. Agradecemos o interesse.');
        }

        try {
            await candidate.send({ embeds: [dmEmbed.setFooter({ text: `Analisado por: ${interaction.user.tag}` })] });
        } catch (e) {
            console.warn(`Não foi possível enviar DM para o candidato ${candidate.id}`);
        }
        
        const originalEmbed = new EmbedBuilder(interaction.message.embeds[0].toJSON())
            .setColor(newStatus === 'approved' ? 'Green' : 'Red')
            .setTitle(`Ficha ${newStatus === 'approved' ? 'Aprovada' : 'Recusada'}`)
            .setFooter({ text: `Decisão de ${interaction.user.tag}` });
        
        await interaction.message.edit({ embeds: [originalEmbed], components: [] });
    }
};

module.exports = enlistmentHandler;