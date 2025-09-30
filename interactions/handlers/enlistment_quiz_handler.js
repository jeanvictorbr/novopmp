// Local: interactions/handlers/enlistment_quiz_handler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');

const userQuizStates = new Map(); // Armazena o progresso do usuário na prova

module.exports = {
    customId: (id) => id.startsWith('quiz_'),

    async execute(interaction) {
        const [action, ...args] = interaction.customId.split('_');

        try {
            if(interaction.isButton()){
                if(action === 'add' && args[0] === 'question') return await this.showQuestionModal(interaction, args[1]);
                if(action === 'start') return await this.startQuiz(interaction, args[0], args[1]);
            }
            if(interaction.isModalSubmit()){
                if(action === 'question' && args[0] === 'modal') return await this.handleQuestionModal(interaction, args[1]);
            }
            if(interaction.isStringSelectMenu()){
                if(action === 'answer') return await this.handleAnswer(interaction, ...args);
            }
        } catch (error) { console.error(`Erro no handler de quiz:`, error); }
    },

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

        const questions = JSON.parse(quiz.questions);
        const newQuestion = {
            question: interaction.fields.getTextInputValue('question'),
            answers: [
                interaction.fields.getTextInputValue('correct'),
                interaction.fields.getTextInputValue('wrong1'),
                interaction.fields.getTextInputValue('wrong2'),
                interaction.fields.getTextInputValue('wrong3'),
            ].filter(Boolean), // Remove respostas vazias
            correct: interaction.fields.getTextInputValue('correct'),
        };
        questions.push(newQuestion);
        
        await db.run('UPDATE enlistment_quizzes SET questions = $1 WHERE quiz_id = $2', [JSON.stringify(questions), quizId]);
        await interaction.reply({content: '✅ Pergunta adicionada com sucesso!', ephemeral: true});
    },

    async startQuiz(interaction, userId, quizId){
        if(interaction.user.id !== userId) return interaction.reply({content: 'Esta prova não é para você.', ephemeral: true});
        const quiz = await db.get('SELECT * FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
        if(!quiz) return interaction.reply({content: 'Prova não encontrada.', ephemeral: true});
        
        const questions = JSON.parse(quiz.questions);
        if(questions.length === 0) return interaction.reply({content: 'Esta prova ainda não tem perguntas.', ephemeral: true});

        userQuizStates.set(userId, {
            quizId,
            questions,
            currentQuestion: 0,
            score: 0,
            passingScore: quiz.passing_score,
        });

        await interaction.deferUpdate();
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
            .addOptions(shuffledAnswers.map((ans, i) => ({ label: ans, value: ans })))
        );
        
        await interaction.editReply({embeds: [embed], components: [menu]});
    },

    async handleAnswer(interaction, userId){
        if(interaction.user.id !== userId) return interaction.reply({content: 'Esta prova não é para você.', ephemeral: true});
        const state = userQuizStates.get(userId);
        if(!state) return;

        const q = state.questions[state.currentQuestion];
        const selectedAnswer = interaction.values[0];

        if(selectedAnswer === q.correct) {
            state.score++;
        }

        state.currentQuestion++;
        
        if(state.currentQuestion >= state.questions.length){
            return this.finishQuiz(interaction, userId);
        } else {
            return this.askQuestion(interaction, userId);
        }
    },
    
    async finishQuiz(interaction, userId){
        const state = userQuizStates.get(userId);
        const finalScore = Math.round((state.score / state.questions.length) * 100);
        const passed = finalScore >= state.passingScore;
        
        await db.run('INSERT INTO enlistment_attempts (user_id, quiz_id, score, passed, attempt_date) VALUES ($1, $2, $3, $4, $5)', 
            [userId, state.quizId, finalScore, passed, Math.floor(Date.now()/1000)]
        );

        const embed = new EmbedBuilder().setTitle('Resultado da Prova Teórica');
        if(passed){
            embed.setColor("Green").setDescription(`**Parabéns! Você foi aprovado com ${finalScore}% de acerto.**\nO cargo de alistado foi entregue a você.`);
            const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;
            if(recruitRoleId) await interaction.member.roles.add(recruitRoleId).catch(console.error);
            await db.run(`UPDATE enlistment_requests SET status = 'approved' WHERE user_id = $1`, [userId]);
        } else {
            embed.setColor("Red").setDescription(`**Você não atingiu a nota mínima. Sua pontuação foi de ${finalScore}%.**\nSua ficha de alistamento foi recusada. Você pode tentar novamente no futuro.`);
            await db.run(`UPDATE enlistment_requests SET status = 'rejected' WHERE user_id = $1`, [userId]);
        }
        
        await interaction.update({embeds: [embed], components: []});
        userQuizStates.delete(userId);
    }
};