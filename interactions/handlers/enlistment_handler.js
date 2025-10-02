const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionsBitField, UserSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { getEnlistmentMenuPayload, getQuizHubPayload, getQuizManagementPayload, SETUP_EMBED_IMAGE_URL, SETUP_FOOTER_TEXT, SETUP_FOOTER_ICON_URL } = require('../../views/setup_views.js');

const userQuizStates = new Map();

//======================================================================
// FUNÇÕES DE ACESSO AO BANCO DE DADOS
//======================================================================
async function getQuestions(quizId) {
    try {
        const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
        if (!quiz || !quiz.questions) return [];
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
// LÓGICA COMPLETA DO QUIZ (QUE ESTAVA EM FALTA)
//======================================================================

async function startQuiz(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const activeQuizId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_id'"))?.value;
    if (!activeQuizId) {
        return interaction.editReply('❌ Nenhuma prova teórica está ativa no momento. Contacte um administrador.');
    }

    const quiz = await db.get('SELECT * FROM enlistment_quizzes WHERE quiz_id = $1', [activeQuizId]);
    const questions = await getQuestions(activeQuizId);

    if (!quiz || !questions || questions.length === 0) {
        return interaction.editReply('❌ A prova teórica ativa não contém perguntas. Contacte um administrador.');
    }

    try {
        const tempChannel = await interaction.guild.channels.create({
            name: `prova-${interaction.user.username.substring(0, 20)}`,
            type: ChannelType.GuildText,
            parent: interaction.channel.parent, // Cria na mesma categoria do canal atual
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
            ],
            topic: `Canal temporário para a prova de ${interaction.user.tag}.`
        });

        const quizState = {
            quiz,
            questions,
            answers: [],
            currentQuestion: 0,
            startTime: Date.now(),
            channelId: tempChannel.id,
        };
        userQuizStates.set(interaction.user.id, quizState);

        await interaction.editReply(`✅ A sua prova foi iniciada no canal privado: ${tempChannel}`);
        await tempChannel.send({ content: `Olá, ${interaction.user}! Bem-vindo(a) à sua prova teórica. Responda às perguntas clicando nos botões. Este canal será apagado automaticamente no final.` });
        await sendQuestion(interaction, tempChannel, quizState);
    } catch (error) {
        console.error("Erro ao criar canal da prova:", error);
        await interaction.editReply('❌ Ocorreu um erro ao criar o seu canal de prova. Verifique se tenho permissões para criar canais nesta categoria.');
    }
}

async function sendQuestion(interaction, channel, quizState, edit = false) {
    const questionData = quizState.questions[quizState.currentQuestion];
    const questionNumber = quizState.currentQuestion + 1;
    const totalQuestions = quizState.questions.length;

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`${quizState.quiz.title} - Pergunta ${questionNumber} de ${totalQuestions}`)
        .setDescription(`**${questionData.question}**`);

    const buttons = new ActionRowBuilder();
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']; // Suporta mais opções
    questionData.options.forEach((option, index) => {
        if (index < letters.length) {
            embed.addFields({ name: `${letters[index]})`, value: option });
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`quiz_answer_${letters[index]}`)
                    .setLabel(letters[index])
                    .setStyle(ButtonStyle.Primary)
            );
        }
    });

    const payload = { embeds: [embed], components: [buttons] };
    try {
        if (edit && interaction.message) {
            await interaction.message.edit(payload);
        } else {
            await channel.send(payload);
        }
    } catch (error) {
        console.error("Erro ao enviar/editar pergunta do quiz:", error);
    }
}

async function handleQuizAnswer(interaction) {
    const quizState = userQuizStates.get(interaction.user.id);
    if (!quizState) {
        return await interaction.update({ content: 'A sua sessão da prova expirou ou não foi encontrada.', embeds: [], components: [] });
    }

    await interaction.deferUpdate();
    const selectedAnswer = interaction.customId.split('_').pop();
    quizState.answers.push(selectedAnswer);
    quizState.currentQuestion++;

    if (quizState.currentQuestion < quizState.questions.length) {
        await sendQuestion(interaction, interaction.channel, quizState, true);
    } else {
        await interaction.message.edit({ content: 'Calculando o seu resultado...', embeds: [], components: [] });
        await endQuiz(interaction, interaction.channel, quizState);
    }
}

async function endQuiz(interaction, channel, quizState) {
    let correctAnswers = 0;
    quizState.questions.forEach((q, index) => {
        if (q.correct.toUpperCase() === quizState.answers[index]) {
            correctAnswers++;
        }
    });

    const finalScore = (correctAnswers / quizState.questions.length) * 100;
    const passed = finalScore >= quizState.quiz.passing_score;

    // --- EMBED PARA O UTILIZADOR (AGORA COM CONTAGEM DE ACERTOS) ---
    const resultEmbed = new EmbedBuilder()
        .setTitle('Resultado da Prova Teórica')
        .setColor(passed ? 'Green' : 'Red')
        .setThumbnail(passed ? 'https://i.imgur.com/7S7R0Zt.png' : 'https://i.imgur.com/c33a49R.png')
        .addFields(
            // --- CAMPO DE ACERTOS ADICIONADO AQUI ---
            { name: 'Acertos', value: `\`${correctAnswers} de ${quizState.questions.length}\``, inline: true },
            { name: 'Sua Nota', value: `\`${finalScore.toFixed(2)}%\``, inline: true },
            { name: 'Status', value: passed ? '✅ **APROVADO**' : '❌ **REPROVADO**', inline: true }
        );

    if (passed) {
        const passedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;
        if (passedRoleId) {
            try {
                await interaction.member.roles.add(passedRoleId);
                resultEmbed.setDescription('Parabéns! Você foi aprovado(a) e recebeu o cargo de acesso para o alistamento.');
            } catch (error) {
                console.error("Erro ao adicionar cargo pós-prova:", error);
                resultEmbed.setDescription('Parabéns! Você foi aprovado(a), mas ocorreu um erro ao adicionar o seu cargo. Contacte um administrador.');
            }
        }
    } else {
        resultEmbed.setDescription('Infelizmente, você não atingiu a nota mínima. Estude mais um pouco e tente novamente mais tarde.');
    }

    await channel.send({ embeds: [resultEmbed] });
    await sendLog(interaction, quizState, finalScore, passed);

    userQuizStates.delete(interaction.user.id);
    await channel.send('Este canal será apagado em 30 segundos.');
    setTimeout(() => channel.delete().catch(console.error), 30000);
}

async function sendLog(interaction, quizState, finalScore, passed) {
    const logChannelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_logs_channel_id'"))?.value;
    if (!logChannelId) return;

    const channel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel) return;

    // --- RESUMO DAS RESPOSTAS CONSTRUÍDO AQUI PARA O LOG DO ADMIN ---
    let summary = '';
    quizState.questions.forEach((q, index) => {
        const userAnswer = quizState.answers[index];
        const isCorrect = q.correct.toUpperCase() === userAnswer;
        const emoji = isCorrect ? '✅' : '❌';
        const questionTitle = q.question.length > 40 ? `${q.question.substring(0, 40)}...` : q.question;
        summary += `${emoji} **Q${index + 1}:** ${questionTitle}\n> Resposta: \`${userAnswer}\` | Correta: \`${q.correct}\`\n`;
    });

    const embed = new EmbedBuilder()
        .setTitle(passed ? 'Relatório de Prova Teórica - Aprovado' : 'Relatório de Prova Teórica - Reprovado')
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .setColor(passed ? 'Green' : 'Red')
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
            { name: 'Candidato', value: interaction.user.toString(), inline: true },
            { name: 'Prova Realizada', value: `\`${quizState.quiz.title}\``, inline: true },
            { name: 'Pontuação', value: `\`${finalScore.toFixed(2)}%\``, inline: true },
            // O resumo detalhado é adicionado aqui
            { name: 'Resumo das Respostas', value: summary } 
        )
        .setTimestamp()
        .setFooter({ text: `ID do Candidato: ${interaction.user.id}` });

    await channel.send({ embeds: [embed] });
}
// ======================================================================
// A FUNÇÃO QUE TU QUERES EDITAR ESTÁ AQUI
// ======================================================================
async function sendLog(interaction, quizState, finalScore, passed) {
    const logChannelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_logs_channel_id'"))?.value;
    if (!logChannelId) return;

    const channel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel) return;

    // --- EDITA ESTA EMBED PARA ALTERAR O LOG DA PROVA ---
    const embed = new EmbedBuilder()
        .setTitle(passed ? '✅ Prova Teórica Aprovada' : '❌ Prova Teórica Reprovada')
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .setColor(passed ? 'Green' : 'Red')
        .setThumbnail('https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmMxa2EwMjY2cWdyNHgxNXFrZmEydHlqbWk5eWJocTV2bDQ1NnVmZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/tf9jjMcO77YzV4YPwE/giphy.gif')
        .addFields(
            { name: 'Candidato', value: interaction.user.toString(), inline: true },
            { name: 'Prova Realizada', value: `\`${quizState.quiz.title}\``, inline: true },
            { name: 'Nota Final', value: `\`${finalScore.toFixed(2)}%\``, inline: true },
            { name: 'Status', value: passed ? '**APROVADO**' : '**REPROVADO**', inline: false },
            { name: 'Resumo das Respostas', value: summary } 
        )
        .setTimestamp()
        .setFooter({ text: `ID do Candidato: ${interaction.user.id}` });
        

    await channel.send({ embeds: [embed] });
}

//======================================================================
// HANDLER PRINCIPAL E OUTRAS FUNÇÕES
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
                if (customId.startsWith('enlistment_apply_modal')) return this.handleEnlistmentModal(interaction);
                return;
            }

            if(interaction.isUserSelectMenu() && customId === 'enlistment_select_recruiter') return this.handleRecruiterSelect(interaction);

            if (customId.startsWith('enlistment_setup_')) return this.handleSetup(interaction);
            if (customId.startsWith('quiz_admin_')) return this.handleQuizAdmin(interaction);
            if (customId === 'enlistment_start_process') return this.handleStartProcess(interaction);
            
            // CHAMADAS CORRIGIDAS
            if (customId === 'quiz_public_start') return startQuiz(interaction);
            if (customId.startsWith('quiz_answer_')) return handleQuizAnswer(interaction);
            
            if (customId.startsWith('enlistment_approve_') || customId.startsWith('enlistment_reject_')) return this.handleApproval(interaction);
        } catch (error) {
            console.error("Erro geral ao processar interação:", error);
            const replyPayload = { content: '❌ Houve um erro crítico.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(replyPayload).catch(() => {});
            else await interaction.reply(replyPayload).catch(() => {});
        }
    },
    
    // Cola aqui o resto do teu ficheiro original, desde a função handleSetup até ao final
    // (Omitido para não repetir o que já sei que tens)
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
        await interaction.deferReply({ ephemeral: true });
        const activeQuizId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_id'"))?.value;
        const quizPassedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;
        if (activeQuizId && quizPassedRoleId && !interaction.member.roles.cache.has(quizPassedRoleId)) {
            return interaction.editReply({ content: '❌ Para se alistar, você precisa primeiro ser aprovado na Prova Teórica.' });
        }
        const existingRequest = await db.get('SELECT 1 FROM enlistment_requests WHERE user_id = $1 AND status = $2', [interaction.user.id, 'pending']);
        if (existingRequest) {
            return interaction.editReply({ content: '❌ Você já possui uma ficha em análise.' });
        }
        const recruiterRoleId = (await db.get("SELECT value FROM settings WHERE key = 'recruiter_role_id'"))?.value;
        if (!recruiterRoleId) {
            return interaction.editReply({ content: '❌ O sistema de alistamento não está configurado corretamente (cargo de recrutador não definido).'});
        }
        await interaction.guild.members.fetch();
        const recruiterRole = await interaction.guild.roles.fetch(recruiterRoleId);
        if (!recruiterRole) {
            return interaction.editReply({ content: '❌ O cargo de recrutador configurado não foi encontrado.' });
        }
        const recruiters = recruiterRole.members;
        if (recruiters.size === 0) {
            return interaction.editReply({ content: '❌ Nenhum recrutador online ou disponível no momento.' });
        }
        const selectMenu = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('enlistment_select_recruiter')
                .setPlaceholder('Selecione quem te recrutou...')
        );
        await interaction.editReply({
            content: '**Etapa 1 de 2:** Por favor, selecione no menu abaixo o oficial que te apresentou à corporação.',
            components: [selectMenu]
        });
    },
    async handleRecruiterSelect(interaction) {
        const recruiterId = interaction.values[0];
        const modal = new ModalBuilder()
            .setCustomId(`enlistment_apply_modal|${recruiterId}`)
            .setTitle('Formulário de Alistamento');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rp_name').setLabel("Nome Completo (RP)").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('game_id').setLabel("Seu ID (no jogo)").setStyle(TextInputStyle.Short).setRequired(true))
        );
        await interaction.showModal(modal);
    },
    async handleEnlistmentModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const [, recruiterId] = interaction.customId.split('|');
        const rpName = interaction.fields.getTextInputValue('rp_name');
        const gameId = interaction.fields.getTextInputValue('game_id');
        const approvalChannelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_approval_channel_id'"))?.value;
        const recruiterRoleId = (await db.get("SELECT value FROM settings WHERE key = 'recruiter_role_id'"))?.value;
        if (!approvalChannelId || !recruiterRoleId) {
            return await interaction.editReply({ content: '❌ O sistema de alistamento não está configurado.' });
        }
        const result = await db.run(
            'INSERT INTO enlistment_requests (user_id, rp_name, game_id, recruiter_id, request_date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING request_id', 
            [interaction.user.id, rpName, gameId, recruiterId, Math.floor(Date.now() / 1000), 'pending']
        );
        const requestId = result.rows[0].request_id;
        const channel = await interaction.guild.channels.fetch(approvalChannelId);
        const embed = new EmbedBuilder()
            .setColor('Yellow')
            .setTitle('📝 Nova Ficha para Análise')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { name: 'Candidato', value: interaction.user.toString(), inline: true },
                { name: 'Recrutado por', value: `<@${recruiterId}>`, inline: true },
                { name: '‎', value: '‎' },
                { name: 'Nome (RP)', value: `\`${rpName}\``, inline: true },
                { name: 'ID (Jogo)', value: `\`${gameId}\``, inline: true }
            )
            .setImage(SETUP_EMBED_IMAGE_URL)
            .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL })
            .setTimestamp();
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`enlistment_approve_${requestId}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`enlistment_reject_${requestId}`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
        );
        await channel.send({ content: `Atenção, <@&${recruiterRoleId}>!`, embeds: [embed], components: [buttons] });
        await interaction.editReply({ content: '✅ A sua ficha foi enviada para análise!' });
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
        await db.run('UPDATE enlistment_requests SET status = $1, approver_id = $2 WHERE request_id = $3', [newStatus, interaction.user.id, requestId]);
        const quizPassedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;
        const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;
        let dmEmbed;
        let finalNickname = null;
        let actionHistoryText = '';
        if (newStatus === 'approved') {
            if (quizPassedRoleId) await candidate.roles.remove(quizPassedRoleId).catch(console.error);
            if (recruitRoleId) await candidate.roles.add(recruitRoleId).catch(console.error);
            dmEmbed = new EmbedBuilder().setColor('Green').setTitle('🎉 Alistamento Aprovado!').setThumbnail('https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmMxa2EwMjY2cWdyNHgxNXFrZmEydHlqbWk5eWJocTV2bDQ1NnVmZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/tf9jjMcO77YzV4YPwE/giphy.gif').setDescription('Parabéns! Sua ficha foi aprovada e seu registro foi concluído.');
            actionHistoryText = `✅ Aprovado por ${interaction.user.toString()}`;
            try {
                const tagConfig = await db.get('SELECT tag FROM role_tags WHERE role_id = $1', [recruitRoleId]);
                if (tagConfig && tagConfig.tag) {
                    finalNickname = `[${tagConfig.tag}] ${request.rp_name} ${request.game_id}`;
                    if (finalNickname.length > 32) finalNickname = finalNickname.substring(0, 32);
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
                { name: 'Recrutado por', value: `<@${request.recruiter_id}>`, inline: true },
                { name: '‎', value: '‎' },
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