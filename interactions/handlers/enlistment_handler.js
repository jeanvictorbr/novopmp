const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const db = require('../../database/db.js');
const { getEnlistmentMenuPayload, getQuizHubPayload, getQuizManagementPayload, SETUP_EMBED_IMAGE_URL, SETUP_FOOTER_TEXT, SETUP_FOOTER_ICON_URL } = require('../../views/setup_views.js');

const userQuizStates = new Map();

//======================================================================
// FUNÇÕES SEGURAS DE ACESSO AO BANCO DE DADOS
//======================================================================
async function getQuestions(quizId) {
    try {
        const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
        if (!quiz) return null;
        if (!quiz.questions) return [];
        if (Array.isArray(quiz.questions)) return quiz.questions;
        if (typeof quiz.questions === 'string') {
            try {
                const parsed = JSON.parse(quiz.questions);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) { return []; }
        }
        return [];
    } catch (error) {
        console.error(`[QUIZ_HANDLER_ERROR] Erro ao buscar perguntas para quiz ${quizId}.`, error);
        return null;
    }
}

async function saveQuestions(quizId, questions) {
    try {
        const questionsJson = JSON.stringify(questions);
        await db.run('UPDATE enlistment_quizzes SET questions = $1 WHERE quiz_id = $2', [questionsJson, quizId]);
        return true;
    } catch (error) {
        console.error(`[QUIZ_HANDLER_ERROR] Erro ao salvar perguntas para quiz ${quizId}.`, error);
        return false;
    }
}

//======================================================================
// HANDLER PRINCIPAL
//======================================================================
const enlistmentHandler = {
    customId: (id) => id.startsWith('enlistment_') || id.startsWith('quiz_') || id === 'delete_cancel',

    async execute(interaction) {
        try {
            const { customId } = interaction;
            if (customId === 'delete_cancel') return await interaction.update({ content: 'Ação cancelada.', components: [], embeds: [] }).catch(() => {});
            
            if (interaction.isModalSubmit()) {
                if (customId === 'quiz_admin_create_modal') return this.handleCreateQuizModal(interaction);
                if (customId.startsWith('quiz_admin_add_question_modal_')) return this.handleAddQuestionModal(interaction);
                if (customId.startsWith('quiz_admin_edit_question_modal')) return this.handleEditQuestionModal(interaction);
                if (customId === 'enlistment_apply_modal') return this.handleEnlistmentModal(interaction);
                return;
            }

            if (customId.startsWith('enlistment_setup_')) return this.handleSetup(interaction);
            if (customId.startsWith('quiz_admin_')) return this.handleQuizAdmin(interaction);
            if (customId === 'enlistment_start_process') return this.handleStartProcess(interaction);
            if (customId === 'quiz_public_start') return this.startQuiz(interaction);
            if (customId.startsWith('quiz_answer_')) return this.handleQuizAnswer(interaction);
            if (customId.startsWith('enlistment_approve_') || customId.startsWith('enlistment_reject_')) return this.handleApproval(interaction);
        } catch (error) {
            console.error("Erro geral ao processar interação:", error);
            const replyPayload = { content: '❌ Houve um erro crítico.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(replyPayload).catch(() => {});
            else await interaction.reply(replyPayload).catch(() => {});
        }
    },

    async handleSetup(interaction) {
        const action = interaction.customId.split('_').slice(2).join('_');
        if (action === 'manage_quizzes') {
            return await interaction.update(await getQuizHubPayload(db));
        }
        const configMap = {
            'set_form_channel': { type: 'channel', dbKey: 'enlistment_form_channel_id', placeholder: 'Selecione o Canal de Alistamento' },
            'set_approval_channel': { type: 'channel', dbKey: 'enlistment_approval_channel_id', placeholder: 'Selecione o Canal de Aprovações' },
            'set_quiz_passed_role': { type: 'role', dbKey: 'enlistment_quiz_passed_role_id', placeholder: 'Selecione o Cargo Pós-Prova' },
            'set_recruit_role': { type: 'role', dbKey: 'enlistment_recruit_role_id', placeholder: 'Selecione o Cargo de Recruta (Final)' },
            'set_recruiter_role': { type: 'role', dbKey: 'recruiter_role_id', placeholder: 'Selecione o Cargo de Recrutador' },
            'set_quiz_logs_channel': { type: 'channel', dbKey: 'enlistment_quiz_logs_channel_id', placeholder: 'Selecione o Canal de Logs das Provas' }
        };
        if (configMap[action]) {
            const { type, dbKey, placeholder } = configMap[action];
            const builder = type === 'channel' ? new ChannelSelectMenuBuilder() : new RoleSelectMenuBuilder();
            const menu = new ActionRowBuilder().addComponents(builder.setCustomId(`enlistment_setup_save_${dbKey}`).setPlaceholder(placeholder));
            await interaction.reply({ content: 'Selecione uma opção no menu.', components: [menu], ephemeral: true });
        } else if (action.startsWith('save_')) {
            const dbKey = action.replace('save_', '');
            await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [dbKey, interaction.values[0]]);
            await interaction.update(await getEnlistmentMenuPayload(db));
        }
    },

    async handleQuizAdmin(interaction) {
        const { customId } = interaction;
    
        if (interaction.isStringSelectMenu()) {
            await interaction.deferUpdate();
            if (customId === 'quiz_admin_select_action') {
                const selectedValue = interaction.values[0];
                if (selectedValue === 'quiz_admin_deactivate') {
                    await db.run("DELETE FROM settings WHERE key = 'enlistment_quiz_id'");
                    await interaction.editReply(await getQuizHubPayload(db));
                } else if (selectedValue.startsWith('quiz_admin_select_')) {
                    const selectedQuizId = selectedValue.split('_').pop();
                    await interaction.editReply(await getQuizManagementPayload(db, selectedQuizId));
                }
            } else if (customId === 'quiz_admin_select_question_to_manage') {
                const [selectedQuizId, questionIndex] = interaction.values[0].split('_');
                const questions = await getQuestions(selectedQuizId);
                const question = questions?.[questionIndex];
                if (!question) return interaction.editReply({ content: '❌ Pergunta não encontrada.', components: [], embeds: [] });
                const embed = new EmbedBuilder().setColor("Yellow").setTitle(`Gerindo Pergunta #${parseInt(questionIndex, 10) + 1}`).setDescription(question.question);
                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`quiz_admin|open_edit_modal|${selectedQuizId}|${questionIndex}`).setLabel("Editar").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`quiz_admin|delete_question|${selectedQuizId}|${questionIndex}`).setLabel("Apagar").setStyle(ButtonStyle.Danger)
                );
                await interaction.editReply({ embeds: [embed], components: [buttons] });
            }
            return;
        }
    
        if (interaction.isButton()) {
            const parts = customId.split('|');
            const mainAction = parts[0];
    
            if (mainAction === 'quiz_admin') {
                const [, action, quizId, questionIndexStr] = parts;
                const questionIndex = parseInt(questionIndexStr, 10);

                if (action === 'open_edit_modal') {
                    const questions = await getQuestions(quizId);
                    const questionData = questions?.[questionIndex];
                    if (!questionData) return interaction.reply({ content: '❌ Pergunta não encontrada ou índice inválido.', ephemeral: true });
                    const modal = new ModalBuilder().setCustomId(`quiz_admin_edit_question_modal|${quizId}|${questionIndex}`).setTitle(`Editando Pergunta #${questionIndex + 1}`);
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('question_text').setLabel("Enunciado").setStyle(TextInputStyle.Paragraph).setValue(questionData.question).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('options').setLabel("Alternativas").setStyle(TextInputStyle.Paragraph).setValue(questionData.options.join('\n')).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('correct_answer').setLabel("Letra Correta").setStyle(TextInputStyle.Short).setValue(questionData.correct).setRequired(true).setMaxLength(1))
                    );
                    return await interaction.showModal(modal);
                }
                if (action === 'delete_question') {
                    await interaction.deferUpdate();
                    const questions = await getQuestions(quizId);
                    if (questions && questionIndex < questions.length) {
                        questions.splice(questionIndex, 1);
                        await saveQuestions(quizId, questions);
                    }
                    return await interaction.editReply(await getQuizManagementPayload(db, quizId));
                }
                return;
            }
    
            const oldParts = customId.split('_');
            const oldAction = oldParts[2];
            
            if (oldAction === 'create') {
                const modal = new ModalBuilder().setCustomId('quiz_admin_create_modal').setTitle('Criar Nova Prova');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quiz_title').setLabel("Título da Prova").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quiz_passing_score').setLabel("Nota Mínima (%)").setStyle(TextInputStyle.Short).setRequired(true))
                );
                return await interaction.showModal(modal);
            }
            if (oldAction === 'back') return await interaction.update(await getEnlistmentMenuPayload(db));
            if (oldAction === 'activate') {
                await interaction.deferUpdate();
                await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['enlistment_quiz_id', oldParts[3]]);
                return await interaction.editReply(await getQuizManagementPayload(db, oldParts[3]));
            }
            if (oldAction === 'add') {
                const modal = new ModalBuilder().setCustomId(`quiz_admin_add_question_modal_${oldParts[4]}`).setTitle('Adicionar Nova Pergunta');
                 modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('question_text').setLabel("Enunciado da Pergunta").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('options').setLabel("Alternativas (uma por linha)").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('correct_answer').setLabel("Letra Correta (A, B, C...)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1))
                );
                return await interaction.showModal(modal);
            }
            if (oldAction === 'edit') {
                const quizId = oldParts[4];
                const questions = await getQuestions(quizId);
                if (!questions || questions.length === 0) return interaction.reply({ content: 'Não há perguntas para editar.', ephemeral: true });
                const options = questions.map((q, index) => ({ label: `Pergunta #${index + 1}: ${q.question.substring(0, 80)}`, value: `${quizId}_${index}` }));
                const selectMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('quiz_admin_select_question_to_manage').setPlaceholder('Selecione uma pergunta...').addOptions(options));
                return await interaction.reply({ content: 'Selecione uma pergunta para gerir:', components: [selectMenu], ephemeral: true });
            }
            if (oldAction === 'delete') {
                const quizId = oldParts[4];
                if (oldParts[3] === 'quiz') {
                    const confirmButton = new ButtonBuilder().setCustomId(`quiz_admin_delete_confirm_${quizId}`).setLabel('Sim, Apagar Prova').setStyle(ButtonStyle.Danger);
                    const cancelButton = new ButtonBuilder().setCustomId('delete_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary);
                    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
                    return await interaction.reply({ content: `⚠️ **Atenção!** Deseja apagar esta prova permanentemente?`, components: [row], ephemeral: true });
                }
                if (oldParts[3] === 'confirm') {
                    await interaction.deferUpdate();
                    await db.run('DELETE FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
                    await db.run("DELETE FROM settings WHERE key = 'enlistment_quiz_id' AND value = $1", [quizId]);
                    return await interaction.editReply(await getQuizHubPayload(db));
                }
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
        await interaction.editReply({ content: `✅ Prova "${title}" criada com sucesso! Volte ao menu para vê-la na lista.` });
    },

    async handleAddQuestionModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const quizId = interaction.customId.split('_').pop();
        try {
            const questionText = interaction.fields.getTextInputValue('question_text');
            const optionsText = interaction.fields.getTextInputValue('options');
            const correctAnswerLetter = interaction.fields.getTextInputValue('correct_answer').toUpperCase();
            const options = optionsText.split('\n').filter(opt => opt.trim() !== '');
            if (options.length < 2) return await interaction.editReply({ content: '❌ Pelo menos duas alternativas são necessárias.' });
            const correctIndex = correctAnswerLetter.charCodeAt(0) - 65;
            if (correctIndex < 0 || correctIndex >= options.length) return await interaction.editReply({ content: `❌ A resposta correta ('${correctAnswerLetter}') é inválida.` });
            const questions = await getQuestions(quizId);
            if (questions === null) return await interaction.editReply({ content: '❌ Erro: A prova correspondente não foi encontrada.' });
            questions.push({ question: questionText, options: options, correct: correctAnswerLetter });
            const success = await saveQuestions(quizId, questions);
            if (success) await interaction.editReply({ content: '✅ Pergunta adicionada com sucesso!' });
            else await interaction.editReply({ content: '❌ Falha ao salvar a pergunta no banco de dados.' });
        } catch (error) {
            console.error("Erro em handleAddQuestionModal:", error);
            await interaction.editReply({ content: '❌ Ocorreu um erro crítico ao processar o formulário.' });
        }
    },

    async handleEditQuestionModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const [, quizId, questionIndexStr] = interaction.customId.split('|');
        const questionIndex = parseInt(questionIndexStr, 10);
        try {
            const questionText = interaction.fields.getTextInputValue('question_text');
            const optionsText = interaction.fields.getTextInputValue('options');
            const correctAnswerLetter = interaction.fields.getTextInputValue('correct_answer').toUpperCase();
            const options = optionsText.split('\n').filter(opt => opt.trim() !== '');
            if (options.length < 2) return await interaction.editReply({ content: '❌ Pelo menos duas alternativas são necessárias.' });
            const correctIndex = correctAnswerLetter.charCodeAt(0) - 65;
            if (correctIndex < 0 || correctIndex >= options.length) return await interaction.editReply({ content: `❌ A resposta correta ('${correctAnswerLetter}') é inválida.` });
            
            const questions = await getQuestions(quizId);
            if (questions === null) return await interaction.editReply({ content: '❌ Erro: A prova correspondente não foi encontrada.' });
            if (!questions[questionIndex]) return await interaction.editReply({ content: '❌ Erro: A pergunta que você tentou editar não existe mais.' });
            
            questions[questionIndex] = { question: questionText, options: options, correct: correctAnswerLetter };

            const success = await saveQuestions(quizId, questions);
            if (success) await interaction.editReply({ content: `✅ Pergunta #${questionIndex + 1} atualizada com sucesso!` });
            else await interaction.editReply({ content: '❌ Falha ao salvar as alterações no banco de dados.' });
        } catch (error) {
            console.error("Erro ao editar pergunta:", error);
            await interaction.editReply({ content: '❌ Ocorreu um erro crítico ao salvar as alterações.' });
        }
    },
    
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
            return await interaction.editReply({ content: '❌ O sistema de alistamento não está configurado.' });
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
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.user.id;
        if (userQuizStates.has(userId)) return interaction.editReply({ content: '❌ Você já está com uma prova em andamento.' });
        const { value: activeQuizId } = await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_id'") || {};
        if (!activeQuizId) return interaction.editReply({ content: 'ℹ️ Nenhuma prova teórica está ativa no momento.' });
        const { value: passedRoleId } = await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'") || {};
        if (!passedRoleId) return interaction.editReply({ content: '❌ O sistema de provas não está totalmente configurado (cargo de aprovado pendente).'});
        if (interaction.member.roles.cache.has(passedRoleId)) return interaction.editReply({ content: '✅ Você já foi aprovado na prova teórica!' });
        const quiz = await db.get('SELECT * FROM enlistment_quizzes WHERE quiz_id = $1', [activeQuizId]);
        const questions = await getQuestions(activeQuizId);
        if (!quiz || !questions || questions.length === 0) return interaction.editReply({ content: '❌ A prova ativa está mal configurada ou não contém perguntas.' });
        
        let channel;
        try {
            const sanitizedUsername = interaction.user.username.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'candidato';
            channel = await interaction.guild.channels.create({
                name: `prova-${sanitizedUsername}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: userId, allow: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
                ],
                reason: `Prova teórica para ${interaction.user.tag}`
            });
        } catch (error) {
            console.error("Erro ao criar canal de prova:", error);
            return interaction.editReply({ content: '❌ Falha ao criar seu canal de prova. Verifique se tenho permissão para "Gerenciar Canais".' });
        }

        const questionMessage = await this.sendQuestion(interaction, channel, { quiz, questions, currentQuestionIndex: 0 });

        const quizState = {
            quiz: quiz,
            questions: questions.sort(() => Math.random() - 0.5),
            currentQuestionIndex: 0,
            score: 0,
            answers: [],
            channelId: channel.id,
            messageId: questionMessage.id,
        };
        userQuizStates.set(userId, quizState);
        await interaction.editReply({ content: `✅ Sua prova começou! Acesse o canal ${channel} para responder.` });
    },

    async sendQuestion(interaction, channel, quizState, edit = false) {
        const questionData = quizState.questions[quizState.currentQuestionIndex];
        const guild = interaction.guild;
        const answerButtons = new ActionRowBuilder();
        const optionsText = questionData.options.map((option, index) => {
            const letter = String.fromCharCode(65 + index);
            answerButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`quiz_answer_${quizState.quiz.quiz_id}_${quizState.currentQuestionIndex}_${letter}`)
                    .setLabel(letter)
                    .setStyle(ButtonStyle.Secondary)
            );
            return `**${letter})** │ ${option}`;
        }).join('\n');
        const embed = new EmbedBuilder()
            .setColor('Navy')
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
            .setTitle(`✍️ Prova Teórica: ${quizState.quiz.title}`)
            .setDescription(`> ### Pergunta ${quizState.currentQuestionIndex + 1} de ${quizState.questions.length}\n> *${questionData.question}*`)
            .addFields({ name: ' ‎ ', value: `\`\`\`markdown\n${optionsText}\n\`\`\``})
            .setImage(SETUP_EMBED_IMAGE_URL)
            .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });
        if (edit && quizState.messageId) {
            const message = await channel.messages.fetch(quizState.messageId).catch(() => null);
            if(message) return await message.edit({ embeds: [embed], components: [answerButtons] });
        }
        return await channel.send({ embeds: [embed], components: [answerButtons] });
    },

    async handleQuizAnswer(interaction) {
        await interaction.deferUpdate();
        const userId = interaction.user.id;
        const quizState = userQuizStates.get(userId);
        if (!quizState || interaction.message.id !== quizState.messageId) return;
        const [, , , questionIndex, chosenLetter] = interaction.customId.split('_');
        const questionData = quizState.questions[questionIndex];
        
        quizState.answers.push({ question: questionData.question, chosen: chosenLetter, correct: questionData.correct });
        if (chosenLetter === questionData.correct) {
            quizState.score++;
        }
        
        const newRow = ActionRowBuilder.from(interaction.message.components[0]);
        newRow.components.forEach((button) => {
            const buttonBuilder = ButtonBuilder.from(button).setDisabled(true);
            if(button.data.label === chosenLetter){
                buttonBuilder.setStyle(ButtonStyle.Primary);
            }
            const buttonIndex = newRow.components.indexOf(button);
            newRow.components[buttonIndex] = buttonBuilder;
        });
        await interaction.editReply({ components: [newRow] });
        quizState.currentQuestionIndex++;
        
        setTimeout(async () => {
            const channel = await interaction.guild.channels.fetch(quizState.channelId);
            if (quizState.currentQuestionIndex < quizState.questions.length) {
                await this.sendQuestion(interaction, channel, quizState, true);
            } else {
                await this.endQuiz(interaction, channel, quizState);
            }
        }, 1000);
    },

    async endQuiz(interaction, channel, quizState) {
        const userId = interaction.user.id;
        const finalScore = (quizState.score / quizState.questions.length) * 100;
        const passed = finalScore >= quizState.quiz.passing_score;
        await db.run(
            'INSERT INTO enlistment_attempts (user_id, quiz_id, score, passed, attempt_date) VALUES ($1, $2, $3, $4, $5)',
            [userId, quizState.quiz.quiz_id, Math.round(finalScore), passed, Math.floor(Date.now() / 1000)]
        );
        const message = await channel.messages.fetch(quizState.messageId).catch(() => null);
        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
            .setTitle(`🏁 Prova Finalizada: ${quizState.quiz.title}`)
            .setImage(SETUP_EMBED_IMAGE_URL)
            .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL })
            .addFields(
                { name: 'Acertos', value: `\`\`\`${quizState.score} de ${quizState.questions.length}\`\`\``, inline: true },
                { name: 'Pontuação Final', value: `\`\`\`${finalScore.toFixed(0)}%\`\`\``, inline: true },
                { name: 'Resultado', value: `**${passed ? '✅ APROVADO' : '❌ REPROVADO'}**`, inline: true }
            );
        if (passed) {
            embed.setColor('Green').setDescription('Parabéns! Você atingiu a nota mínima. Agora você pode prosseguir para o alistamento.');
            const { value: passedRoleId } = await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'") || {};
            if (passedRoleId) {
                try {
                    await interaction.member.roles.add(passedRoleId);
                    embed.addFields({ name: 'Cargo Recebido', value: `<@&${passedRoleId}>` });
                } catch (e) {
                    channel.send('⚠️ Não foi possível atribuir seu cargo de aprovado. Contate um administrador.');
                }
            }
        } else {
            embed.setColor('Red').setDescription(`Infelizmente você não atingiu a nota mínima de **${quizState.quiz.passing_score}%**.`);
        }
        if (message) await message.edit({ embeds: [embed], components: [] });
        else await channel.send({ embeds: [embed], components: [] });
        await this.sendLog(interaction, quizState, finalScore, passed);
        await channel.send(`Este canal será excluído em 1 minuto.`);
        userQuizStates.delete(userId);
        setTimeout(() => channel.delete('Prova concluída.').catch(() => {}), 60000);
    },

    async sendLog(interaction, quizState, finalScore, passed) {
        const { value: logChannelId } = await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_logs_channel_id'") || {};
        if (!logChannelId) return;
        const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;
        const answersSummary = quizState.answers.map((ans, index) => {
            const emoji = ans.chosen === ans.correct ? '✅' : '❌';
            return `> ${emoji} **Q${index + 1}:** ${ans.question.substring(0, 50)}...\n> Resposta: \`${ans.chosen}\` | Correta: \`${ans.correct}\``;
        }).join('\n');
        const logEmbed = new EmbedBuilder()
            .setColor(passed ? 'Green' : 'Red')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`Relatório de Prova Teórica - ${passed ? 'Aprovado' : 'Reprovado'}`)
            .addFields(
                { name: 'Candidato', value: interaction.user.toString(), inline: true },
                { name: 'Prova Realizada', value: `\`${quizState.quiz.title}\``, inline: true },
                { name: 'Pontuação', value: `\`${finalScore.toFixed(0)}%\``, inline: true },
                { name: 'Resumo das Respostas', value: answersSummary || 'Nenhuma resposta registrada.' }
            )
            .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
    },
    
    async handleApproval(interaction) {
        await interaction.deferUpdate();
        const [action, requestId] = interaction.customId.replace('enlistment_', '').split('_');
        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        const request = await db.get('SELECT * FROM enlistment_requests WHERE request_id = $1', [requestId]);
        if (!request || request.status !== 'pending') {
            return interaction.message.edit({ components: [] });
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
        let finalNickname = null;
        let actionHistoryText = '';
        if (newStatus === 'approved') {
            if (quizPassedRoleId) await candidate.roles.remove(quizPassedRoleId).catch(console.error);
            if (recruitRoleId) await candidate.roles.add(recruitRoleId).catch(console.error);
            dmEmbed = new EmbedBuilder().setColor('Green').setTitle('🎉 Alistamento Aprovado!').setDescription('Parabéns! Sua ficha foi aprovada e seu registro foi concluído.');
            actionHistoryText = `✅ Aprovado por ${interaction.user.toString()}`;
            try {
                const tagConfig = await db.get('SELECT tag FROM role_tags WHERE role_id = $1', [recruitRoleId]);
                if (tagConfig && tagConfig.tag) {
                    finalNickname = `[${tagConfig.tag}] ${request.rp_name} ${request.game_id}`;
                    if (finalNickname.length > 32) {
                        finalNickname = finalNickname.substring(0, 32);
                    }
                    await candidate.setNickname(finalNickname, 'Alistamento Aprovado');
                }
            } catch (error) {
                console.error("Falha ao tentar alterar o nickname:", error);
                await interaction.followUp({ content: `⚠️ O candidato ${candidate.toString()} foi aprovado, mas não foi possível alterar seu nickname (provavelmente por ter um cargo superior ao meu).`, ephemeral: true });
            }
        } else {
            if (quizPassedRoleId) await candidate.roles.remove(quizPassedRoleId).catch(console.error);
            dmEmbed = new EmbedBuilder().setColor('Red').setTitle('❌ Alistamento Recusado').setDescription('Sua ficha foi recusada. Agradecemos o interesse.');
            actionHistoryText = `❌ Recusado por ${interaction.user.toString()}`;
        }
        try {
            await candidate.send({ embeds: [dmEmbed.setFooter({ text: `Analisado por: ${interaction.user.tag}` })] });
        } catch (e) {
            console.warn(`Não foi possível enviar DM para o candidato ${candidate.id}`);
        }
        const decisionEmbed = new EmbedBuilder()
            .setColor(newStatus === 'approved' ? 'Green' : 'Red')
            .setTitle(`Ficha de Alistamento ${newStatus === 'approved' ? 'Aprovada' : 'Recusada'}`)
            .setAuthor({ name: `Decisão de ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setThumbnail(candidate.user.displayAvatarURL())
            .addFields(
                { name: 'Candidato', value: candidate.toString(), inline: true },
                { name: 'Nome (RP)', value: `\`${request.rp_name}\``, inline: true },
                { name: 'ID (Jogo)', value: `\`${request.game_id}\``, inline: true },
                { name: 'Histórico de Ações', value: actionHistoryText }
            )
            .setImage(SETUP_EMBED_IMAGE_URL)
            .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL })
            .setTimestamp();
        if (newStatus === 'approved' && finalNickname) {
            decisionEmbed.addFields({ name: 'Nickname Definido', value: `\`${finalNickname}\`` });
        }
        await interaction.message.edit({ embeds: [decisionEmbed], components: [] });
    }
};

module.exports = enlistmentHandler;