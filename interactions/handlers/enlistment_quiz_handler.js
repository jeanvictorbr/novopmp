// Local: interactions/handlers/enlistment_quiz_handler.js

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');

const userQuizStates = new Map();

async function createQuizManagerEmbed(quizId) {
    const quiz = await db.get('SELECT * FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
    if (!quiz) return { embeds: [new EmbedBuilder().setColor("Red").setTitle("Erro").setDescription("Prova não encontrada.")] };

    // CORRIGIDO: Garante que 'questions' seja sempre um array, mesmo que o campo seja nulo ou inválido
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
            new ButtonBuilder().setCustomId(`quiz_edit_question_select_${quizId}`).setLabel('Editar/Ver Pergunta').setStyle(ButtonStyle.Primary).setEmoji('✏️').setDisabled(questions.length === 0),
            new ButtonBuilder().setCustomId(`quiz_delete_${quizId}`).setLabel('Apagar Prova').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        ),
        new ActionRowBuilder().addComponents(
             new ButtonBuilder().setCustomId(`enlistment_setup_manage_quiz`).setLabel('Voltar para Gerenciador').setStyle(ButtonStyle.Secondary)
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
            if(interaction.isButton()){
                if(action === 'add' && args[0] === 'question') return await this.showQuestionModal(interaction, args[1]);
                if(action === 'edit' && args[0] === 'question' && args[1] === 'select') return await this.showQuestionSelect(interaction, args[2]);
                if(action === 'delete') return await this.deleteQuiz(interaction, args[0]);
                if(action === 'start') return await this.startQuiz(interaction, args[0], args[1]);
            }
            if(interaction.isModalSubmit()){
                if(action === 'question' && args[0] === 'modal') return await this.handleQuestionModal(interaction, args[1]);
                if(action === 'edit' && args[0] === 'question' && args[1] === 'modal') return await this.handleEditQuestionModal(interaction, args[2], args[3]);
            }
            if(interaction.isStringSelectMenu()){
                if(action === 'answer') return await this.handleAnswer(interaction, userId = args[0]);
                if(action === 'edit' && args[0] === 'question') return await this.showEditQuestionModal(interaction, args[1], interaction.values[0]);
                if(action === 'public' && args[0] === 'select') {
                    const [, , userId, quizId] = interaction.values[0].split('_');
                    return await this.startQuiz(interaction, interaction.user.id, quizId, true);
                }
                if(action === 'manage' && args[0] === 'select') {
                    const quizId = interaction.values[0];
                    const { embeds, components } = await createQuizManagerEmbed(quizId);
                    return await interaction.update({ embeds, components });
                }
            }
        } catch (error) { console.error(`Erro no handler de quiz:`, error); }
    },
    
    // As outras funções permanecem as mesmas, mas estou incluindo o arquivo completo por segurança.
    // ...

    // ... (rest of the functions from previous step are here) ...
    // Funções existentes que não precisam de alteração
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
        
        const { embeds, components } = await createQuizManagerEmbed(quizId);
        await interaction.update({ content: '✅ Pergunta adicionada com sucesso!', embeds, components});
    },

    async startQuiz(interaction, userId, quizId, isPublic = false){
        if(interaction.user.id !== userId) return interaction.reply({content: 'Esta prova não é para você.', ephemeral: true});
        const quiz = await db.get('SELECT * FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
        if(!quiz) return interaction.reply({content: 'Prova não encontrada.', ephemeral: true});
        
        const questions = JSON.parse(quiz.questions || '[]');
        if(questions.length === 0) return interaction.reply({content: 'Esta prova ainda não tem perguntas.', ephemeral: true});

        userQuizStates.set(userId, {
            quizId,
            questions,
            currentQuestion: 0,
            score: 0,
            passingScore: quiz.passing_score,
            isPublic
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
            .addOptions(shuffledAnswers.map((ans) => ({ label: ans, value: ans })))
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

        if (state.isPublic) {
            if(passed){
                embed.setColor("Green").setDescription(`**Parabéns! Você foi aprovado com ${finalScore}% de acerto.**`);
            } else {
                embed.setColor("Red").setDescription(`**Você não atingiu a nota mínima. Sua pontuação foi de ${finalScore}%.**\nEstude mais um pouco e tente novamente.`);
            }
        } 
        else {
            if(passed){
                embed.setColor("Green").setDescription(`**Parabéns! Você foi aprovado com ${finalScore}% de acerto.**\nO cargo de alistado foi entregue a você.`);
                const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;
                if(recruitRoleId) await interaction.member.roles.add(recruitRoleId).catch(console.error);
                await db.run(`UPDATE enlistment_requests SET status = 'approved' WHERE user_id = $1`, [userId]);
            } else {
                embed.setColor("Red").setDescription(`**Você não atingiu a nota mínima. Sua pontuação foi de ${finalScore}%.**\nSua ficha de alistamento foi recusada. Você pode tentar novamente no futuro.`);
                await db.run(`UPDATE enlistment_requests SET status = 'rejected' WHERE user_id = $1`, [userId]);
            }
        }
        
        await interaction.update({embeds: [embed], components: []});
        userQuizStates.delete(userId);
    },
    async showQuestionSelect(interaction, quizId) {
        const quiz = await db.get('SELECT questions FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
        const questions = JSON.parse(quiz.questions || '[]');
        
        const options = questions.map((q, index) => ({
            label: `Pergunta ${index + 1}: ${q.question.substring(0, 80)}`,
            value: index.toString()
        }));

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`quiz_edit_question_${quizId}`)
                .setPlaceholder("Selecione uma pergunta para editar...")
                .addOptions(options)
        );
        await interaction.reply({ content: "Selecione a pergunta que deseja editar.", components: [menu], ephemeral: true });
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
            answers: [
                interaction.fields.getTextInputValue('correct'),
                interaction.fields.getTextInputValue('wrong1'),
                interaction.fields.getTextInputValue('wrong2'),
                interaction.fields.getTextInputValue('wrong3'),
            ].filter(Boolean),
            correct: interaction.fields.getTextInputValue('correct'),
        };

        await db.run('UPDATE enlistment_quizzes SET questions = $1 WHERE quiz_id = $2', [JSON.stringify(questions), quizId]);
        
        const { embeds, components } = await createQuizManagerEmbed(quizId);
        await interaction.update({ content: "✅ Pergunta atualizada!", embeds, components });
    },

    async deleteQuiz(interaction, quizId) {
        // Adicionando uma confirmação
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`quiz_confirm_delete_${quizId}`).setLabel("Sim, apagar").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`quiz_cancel_delete`).setLabel("Cancelar").setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ content: `Tem certeza que deseja apagar esta prova permanentemente? Esta ação não pode ser desfeita.`, components: [row], ephemeral: true });
        
        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000, max: 1 });

        collector.on('collect', async i => {
            if (i.customId === `quiz_confirm_delete_${quizId}`) {
                await db.run('DELETE FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
                await i.update({ content: '✅ Prova apagada com sucesso!', components: [] });
            } else {
                await i.update({ content: 'Ação cancelada.', components: [] });
            }
        });
    }
};