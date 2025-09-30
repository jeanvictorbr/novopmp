// Local: interactions/handlers/enlistment_quiz_handler.js

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');

const userQuizStates = new Map();

async function createQuizManagerEmbed(quizId) {
    const quiz = await db.get('SELECT * FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
    if (!quiz) {
        return { 
            embeds: [new EmbedBuilder().setColor("Red").setTitle("Erro").setDescription("Prova não encontrada. Pode ter sido apagada.")], 
            components: [] 
        };
    }
    const questions = JSON.parse(quiz.questions || '[]');
    const embed = new EmbedBuilder()
        .setColor('Purple')
        .setTitle(`🛠️ Gerenciando a Prova: ${quiz.title}`)
        .setDescription(`**ID da Prova:** \`${quiz.quiz_id}\`\n**Nota Mínima:** \`${quiz.passing_score}%\`\n**Nº de Perguntas:** \`${questions.length}\``)
        .setFooter({ text: "Use os botões abaixo para configurar esta prova." });
    
    if (questions.length > 0) {
        const questionList = questions.map((q, index) => `**${index + 1}.** ${q.question.substring(0, 50)}...`).join('\n');
        embed.addFields({ name: "Perguntas Atuais", value: questionList });
    } else {
        embed.addFields({ name: "Perguntas Atuais", value: "Nenhuma pergunta adicionada ainda." });
    }
    const components = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`quiz_add_question_${quizId}`).setLabel('Adicionar Pergunta').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId(`quiz_edit_question_select_${quizId}`).setLabel('Editar/Apagar Pergunta').setStyle(ButtonStyle.Primary).setEmoji('✏️').setDisabled(questions.length === 0),
            new ButtonBuilder().setCustomId(`quiz_delete_${quizId}`).setLabel('Apagar Prova').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        ),
        new ActionRowBuilder().addComponents(
             new ButtonBuilder().setCustomId(`enlistment_setup_manage_quizzes`).setLabel('Voltar').setStyle(ButtonStyle.Secondary)
        )
    ];
    return { embeds: [embed], components };
}

module.exports = {
    customId: (id) => id.startsWith('quiz_'),
    createQuizManagerEmbed,

    async execute(interaction) {
        const [action, ...args] = interaction.customId.split('_');
        try {
            if (interaction.isButton()) {
                const btnAction = args.join('_');
                if (action === 'add' && btnAction === 'question') return await this.showQuestionModal(interaction, args[1]);
                if (action === 'edit' && btnAction === 'question_select') return await this.showQuestionSelect(interaction, args[2]);
                if (action === 'delete') return await this.deleteQuiz(interaction, args[0]);
                if (action === 'start') return await this.startQuiz(interaction, args[0], args[1], true);
                if (action === 'create' && btnAction === 'new') return await this.showCreateQuizModal(interaction);
                if (action === 'confirm' && btnAction.startsWith('delete')) return await this.handleDeleteConfirmation(interaction, args[1]);
                if (action === 'cancel' && btnAction === 'delete') {
                    const { showQuizHub } = require('./enlistment_setup_handler.js');
                    const payload = await showQuizHub();
                    return await interaction.update({ content: 'Ação cancelada.', ...payload});
                }
            }
            if (interaction.isStringSelectMenu()) {
                const menuAction = args.join('_');
                if (action === 'answer') return await this.handleAnswer(interaction, args[0]);
                if (action === 'edit' && menuAction === 'question') return await this.showEditQuestionModal(interaction, args[1], interaction.values[0]);
                if (action === 'public' && menuAction === 'select') return await this.startQuiz(interaction, interaction.user.id, interaction.values[0].split('_').pop(), true);
                if (action === 'manage' && menuAction === 'select') return await this.manageSelectedQuiz(interaction);
            }
            if (interaction.isModalSubmit()) {
                if (action === 'create' && args.join('_') === 'modal') return await this.handleCreateQuizModal(interaction);
                if (action === 'question' && args.join('_') === 'modal') return await this.handleQuestionModal(interaction, args[1]);
                if (action === 'edit' && args[0] === 'question' && args[1] === 'modal') return await this.handleEditQuestionModal(interaction, args[2], args[3]);
            }
        } catch (error) { console.error(`Erro no handler de quiz:`, error); }
    },
    
    // --- FUNÇÕES DE GESTÃO (ADMIN) ---
    async showCreateQuizModal(interaction) {
        const modal = new ModalBuilder().setCustomId('quiz_create_modal').setTitle('Criar Nova Prova Teórica');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título da Prova').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('passing_score').setLabel('Nota Mínima de Aprovação (0-100)').setStyle(TextInputStyle.Short).setValue('70').setRequired(true))
        );
        await interaction.showModal(modal);
    },
    async handleCreateQuizModal(interaction) {
        const title = interaction.fields.getTextInputValue('title');
        const passingScore = parseInt(interaction.fields.getTextInputValue('passing_score'));
        if (isNaN(passingScore) || passingScore < 0 || passingScore > 100) return interaction.reply({ content: "Nota mínima inválida.", ephemeral: true });
        const result = await db.run('INSERT INTO enlistment_quizzes (title, questions, passing_score) VALUES ($1, $2, $3) RETURNING quiz_id', [title, '[]', passingScore]);
        const { embeds, components } = await createQuizManagerEmbed(result.rows[0].quiz_id);
        await interaction.update({ embeds, components });
    },
    async manageSelectedQuiz(interaction) {
        const quizId = interaction.values[0];
        const { embeds, components } = await createQuizManagerEmbed(quizId);
        await interaction.update({ embeds, components });
    },
    async deleteQuiz(interaction, quizId) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`quiz_confirm_delete_${quizId}`).setLabel("Sim, Apagar").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`quiz_cancel_delete`).setLabel("Cancelar").setStyle(ButtonStyle.Secondary)
        );
        await interaction.update({ content: `Tem a certeza que deseja apagar esta prova permanentemente?`, components: [row], embeds: [] });
    },
    async handleDeleteConfirmation(interaction, quizId) {
        await db.run('DELETE FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
        const { showQuizHub } = require('./enlistment_setup_handler.js');
        const payload = await showQuizHub();
        await interaction.update({ content: '✅ Prova apagada com sucesso!', ...payload });
    },

    // --- FUNÇÕES DE GESTÃO DE PERGUNTAS ---
    async showQuestionModal(interaction, quizId){
        const modal = new ModalBuilder().setCustomId(`quiz_question_modal_${quizId}`).setTitle('Adicionar Nova Pergunta');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('question').setLabel('Pergunta').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('correct').setLabel('Alternativa Correta').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('wrong1').setLabel('Alternativa Errada 1').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('wrong2').setLabel('Alternativa Errada 2').setStyle(TextInputStyle.Short).setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('wrong3').setLabel('Alternativa Errada 3').setStyle(TextInputStyle.Short).setRequired(false)),
        );
        await interaction.showModal(modal);
    },
    async handleQuestionModal(interaction, quizId){
        const quiz = await db.get('SELECT * FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
        if(!quiz) return;
        const questions = JSON.parse(quiz.questions || '[]');
        questions.push({
            question: interaction.fields.getTextInputValue('question'),
            answers: [interaction.fields.getTextInputValue('correct'), interaction.fields.getTextInputValue('wrong1'), interaction.fields.getTextInputValue('wrong2'), interaction.fields.getTextInputValue('wrong3')].filter(Boolean),
            correct: interaction.fields.getTextInputValue('correct'),
        });
        await db.run('UPDATE enlistment_quizzes SET questions = $1 WHERE quiz_id = $2', [JSON.stringify(questions), quizId]);
        const { embeds, components } = await createQuizManagerEmbed(quizId);
        await interaction.update({ content: '✅ Pergunta adicionada!', embeds, components});
    },
    async showQuestionSelect(interaction, quizId) {
        const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
        const questions = JSON.parse(quiz.questions || '[]');
        const options = questions.map((q, index) => ({ label: `Pergunta ${index + 1}: ${q.question.substring(0, 80)}`, value: index.toString() }));
        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`quiz_edit_question_${quizId}`).setPlaceholder("Selecione uma pergunta para editar...").addOptions(options));
        await interaction.update({ content: "Selecione a pergunta que deseja editar.", components: [menu], embeds: [] });
    },
    async showEditQuestionModal(interaction, quizId, questionIndex) {
        const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
        const questions = JSON.parse(quiz.questions || '[]');
        const q = questions[questionIndex];
        const modal = new ModalBuilder().setCustomId(`quiz_edit_question_modal_${quizId}_${questionIndex}`).setTitle(`Editando Pergunta ${parseInt(questionIndex) + 1}`);
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('question').setLabel('Pergunta').setStyle(TextInputStyle.Short).setRequired(true).setValue(q.question)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('correct').setLabel('Alternativa Correta').setStyle(TextInputStyle.Short).setRequired(true).setValue(q.correct)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('wrong1').setLabel('Alternativa Errada 1').setStyle(TextInputStyle.Short).setRequired(true).setValue(q.answers.filter(a => a !== q.correct)[0] || '')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('wrong2').setLabel('Alternativa Errada 2').setStyle(TextInputStyle.Short).setRequired(false).setValue(q.answers.filter(a => a !== q.correct)[1] || '')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('wrong3').setLabel('Alternativa Errada 3').setStyle(TextInputStyle.Short).setRequired(false).setValue(q.answers.filter(a => a !== q.correct)[2] || ''))
        );
        await interaction.showModal(modal);
    },
    async handleEditQuestionModal(interaction, quizId, questionIndex) {
        const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
        const questions = JSON.parse(quiz.questions || '[]');
        questions[questionIndex] = {
            question: interaction.fields.getTextInputValue('question'),
            answers: [interaction.fields.getTextInputValue('correct'), interaction.fields.getTextInputValue('wrong1'), interaction.fields.getTextInputValue('wrong2'), interaction.fields.getTextInputValue('wrong3')].filter(Boolean),
            correct: interaction.fields.getTextInputValue('correct'),
        };
        await db.run('UPDATE enlistment_quizzes SET questions = $1 WHERE quiz_id = $2', [JSON.stringify(questions), quizId]);
        const { embeds, components } = await createQuizManagerEmbed(quizId);
        await interaction.update({ content: "✅ Pergunta atualizada!", embeds, components });
    },

    // --- FUNÇÕES DE REALIZAÇÃO DA PROVA (PÚBLICO) ---
    async startQuiz(interaction, userId, quizId, isPublic = false){
        await interaction.deferReply({ ephemeral: true });
        const quiz = await db.get('SELECT * FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
        if(!quiz) return interaction.editReply({content: 'Prova não encontrada.'});
        const questions = JSON.parse(quiz.questions || '[]');
        if(questions.length === 0) return interaction.editReply({content: 'Esta prova ainda não tem perguntas.'});
        userQuizStates.set(userId, { quizId, questions, currentQuestion: 0, score: 0, passingScore: quiz.passing_score, isPublic });
        await interaction.editReply({ content: 'A sua prova vai começar! Responda às perguntas que serão enviadas a seguir.', embeds: [], components: [] });
        return this.askQuestion(interaction, userId);
    },
    async askQuestion(interaction, userId){
        const state = userQuizStates.get(userId);
        if(!state) return;
        const q = state.questions[state.currentQuestion];
        const shuffledAnswers = q.answers.sort(() => Math.random() - 0.5);
        const embed = new EmbedBuilder().setColor("Blue").setTitle(`Pergunta ${state.currentQuestion + 1} de ${state.questions.length}`).setDescription(`**${q.question}**`);
        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
            .setCustomId(`quiz_answer_${userId}`)
            .setPlaceholder('Selecione a sua resposta...')
            .addOptions(shuffledAnswers.map((ans) => ({ label: ans.substring(0, 100), value: ans })))
        );
        await interaction.followUp({embeds: [embed], components: [menu], ephemeral: true});
    },
    async handleAnswer(interaction, userId){
        if(interaction.user.id !== userId) return;
        const state = userQuizStates.get(userId);
        if(!state) return;
        await interaction.message.delete();
        const q = state.questions[state.currentQuestion];
        if(interaction.values[0] === q.correct) state.score++;
        state.currentQuestion++;
        if(state.currentQuestion >= state.questions.length){
            return this.finishQuiz(interaction, userId);
        } else {
            return this.askQuestion(interaction, userId);
        }
    },
    async finishQuiz(interaction, userId){
        const state = userQuizStates.get(userId);
        const finalScore = state.questions.length > 0 ? Math.round((state.score / state.questions.length) * 100) : 0;
        const passed = finalScore >= state.passingScore;
        await db.run('INSERT INTO enlistment_attempts (user_id, quiz_id, score, passed, attempt_date) VALUES ($1, $2, $3, $4, $5)', [userId, state.quizId, finalScore, passed, Math.floor(Date.now()/1000)]);
        const embed = new EmbedBuilder().setTitle('Resultado da Prova Teórica');
        if(passed){
            embed.setColor("Green").setDescription(`**Parabéns! Você foi aprovado com ${finalScore}% de acerto.**`);
            const quizPassedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;
            const formChannelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_form_channel_id'"))?.value;
            if(quizPassedRoleId) {
                try {
                    await interaction.member.roles.add(quizPassedRoleId);
                    embed.description += `\nVocê recebeu o cargo <@&${quizPassedRoleId}>.`;
                } catch (e) { console.error("Erro ao dar cargo pós-prova:", e)}
            }
            if(formChannelId){
                embed.description += `\n\n**Próximo Passo:** [Clique aqui para ir ao canal de alistamento](https://discord.com/channels/${interaction.guild.id}/${formChannelId}) e preencher a sua ficha.`;
            }
        } else {
            embed.setColor("Red").setDescription(`**Você não atingiu a nota mínima. Sua pontuação foi de ${finalScore}%.**\nAgradecemos o seu interesse.`);
        }
        await interaction.followUp({embeds: [embed], components: [], ephemeral: true});
        userQuizStates.delete(userId);
    },
};