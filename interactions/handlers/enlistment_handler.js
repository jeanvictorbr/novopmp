const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { getEnlistmentMenuPayload } = require('../../views/setup_views.js');

// Mapa para armazenar o estado das provas dos usuários
const userQuizStates = new Map();

const enlistmentHandler = {
    customId: (id) => id.startsWith('enlistment_') || id.startsWith('quiz_'),

    async execute(interaction) {
        const { customId } = interaction;
        
        // --- ROTAS DE CONFIGURAÇÃO (/setup) ---
        if (customId.startsWith('enlistment_setup_')) return this.handleSetup(interaction);
        if (customId.startsWith('quiz_admin_')) return this.handleQuizAdmin(interaction);

        // --- ROTAS PÚBLICAS (CANDIDATO) ---
        if (customId === 'enlistment_start_process') return this.handleStartProcess(interaction);
        if (customId === 'quiz_public_start') return this.startQuiz(interaction);
        if (customId.startsWith('quiz_answer_')) return this.handleQuizAnswer(interaction);

        // --- ROTAS DE RECRUTADOR ---
        if (customId.startsWith('enlistment_approve_') || customId.startsWith('enlistment_reject_')) return this.handleApproval(interaction);
        
        // --- MODALS ---
        if (interaction.isModalSubmit()) {
            if (customId === 'enlistment_apply_modal') return this.handleEnlistmentModal(interaction);
            if (customId === 'quiz_admin_create_modal') return this.handleCreateQuizModal(interaction);
            // Adicionar outros modals aqui
        }
    },

    //==================================
    // LÓGICA DE CONFIGURAÇÃO (ADMIN)
    //==================================
    async handleSetup(interaction) {
        const action = interaction.customId.split('_').slice(2).join('_');

        const configMap = {
            'set_form_channel': { type: 'channel', dbKey: 'enlistment_form_channel_id', placeholder: 'Selecione o Canal de Alistamento' },
            'set_approval_channel': { type: 'channel', dbKey: 'enlistment_approval_channel_id', placeholder: 'Selecione o Canal de Aprovações' },
            'set_quiz_passed_role': { type: 'role', dbKey: 'enlistment_quiz_passed_role_id', placeholder: 'Selecione o Cargo Pós-Prova' },
            'set_recruit_role': { type: 'role', dbKey: 'enlistment_recruit_role_id', placeholder: 'Selecione o Cargo de Recruta (Final)' },
            'set_recruiter_role': { type: 'role', dbKey: 'recruiter_role_id', placeholder: 'Selecione o Cargo de Recrutador' }
        };

        if (action === 'manage_quizzes') {
            // Lógica para mostrar o Hub de Provas
            // ... (será implementada)
            return interaction.reply({ content: 'Hub de Provas em construção.', ephemeral: true });
        }

        if (configMap[action]) {
            const config = configMap[action];
            const builder = config.type === 'channel' ? new ChannelSelectMenuBuilder() : new RoleSelectMenuBuilder();
            const menu = new ActionRowBuilder().addComponents(
                builder.setCustomId(`enlistment_setup_save_${config.dbKey}`).setPlaceholder(config.placeholder)
            );
            await interaction.reply({ content: 'Selecione uma opção no menu.', components: [menu], ephemeral: true });
        } else if (action.startsWith('save_')) {
            const dbKey = action.replace('save_', '');
            await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = ?', [dbKey, interaction.values[0], interaction.values[0]]);
            const payload = await getEnlistmentMenuPayload(db);
            await interaction.update(payload);
        }
    },

    async handleQuizAdmin(interaction) {
        // Toda a lógica de criar, editar, apagar e ativar provas irá aqui.
    },


    //==================================
    // LÓGICA PÚBLICA (CANDIDATO)
    //==================================
    async handleStartProcess(interaction) {
        const activeQuizId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_id'"))?.value;
        const quizPassedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;

        // Modo Teórico: Verifica se o cargo é necessário e se o membro o possui
        if (activeQuizId && quizPassedRoleId && !interaction.member.roles.cache.has(quizPassedRoleId)) {
            return interaction.reply({
                content: '❌ Para se alistar, você precisa primeiro ser aprovado na Prova Teórica. Por favor, procure o painel de provas.',
                ephemeral: true
            });
        }
        
        // Verifica se já existe uma ficha pendente
        const existingRequest = await db.get('SELECT 1 FROM enlistment_requests WHERE user_id = ? AND status = ?', [interaction.user.id, 'pending']);
        if (existingRequest) {
            return interaction.reply({ content: '❌ Você já possui uma ficha em análise.', ephemeral: true });
        }

        // Abre o formulário (modal)
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
            return interaction.editReply({ content: '❌ O sistema de alistamento não está totalmente configurado. Contate um administrador.' });
        }

        const result = await db.run('INSERT INTO enlistment_requests (user_id, rp_name, game_id, request_date, status) VALUES (?, ?, ?, ?, ?) RETURNING request_id', [interaction.user.id, rpName, gameId, Math.floor(Date.now() / 1000), 'pending']);
        const requestId = result.lastID;
        
        const channel = await interaction.guild.channels.fetch(approvalChannelId);
        const embed = new EmbedBuilder().setColor('Yellow').setTitle('📝 Nova Ficha para Análise').setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .addFields(
                { name: 'Candidato', value: interaction.user.toString() },
                { name: 'Nome (RP)', value: `\`${rpName}\`` },
                { name: 'ID (Jogo)', value: `\`${gameId}\`` }
            );
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`enlistment_approve_${requestId}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`enlistment_reject_${requestId}`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
        );
        await channel.send({ content: `Atenção, <@&${recruiterRoleId}>!`, embeds: [embed], components: [buttons] });
        
        await interaction.editReply({ content: '✅ A sua ficha foi enviada para análise! Aguarde o contacto de um recrutador.' });
    },
    
    // ... Lógica das provas (startQuiz, handleQuizAnswer) ...

    //==================================
    // LÓGICA DO RECRUTADOR
    //==================================
    async handleApproval(interaction) {
        await interaction.deferUpdate();
        const [action, requestId] = interaction.customId.replace('enlistment_', '').split('_');
        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        const request = await db.get('SELECT * FROM enlistment_requests WHERE request_id = ?', [requestId]);
        if (!request || request.status !== 'pending') {
            return interaction.editReply({ content: 'Esta ficha já foi analisada.', components: [] });
        }

        const candidate = await interaction.guild.members.fetch(request.user_id).catch(() => null);
        if (!candidate) {
            await db.run('DELETE FROM enlistment_requests WHERE request_id = ?', [requestId]);
            return interaction.editReply({ content: 'Candidato não encontrado no servidor. Ficha removida.', components: [], embeds: [] });
        }

        await db.run('UPDATE enlistment_requests SET status = ?, recruiter_id = ? WHERE request_id = ?', [newStatus, interaction.user.id, requestId]);

        const quizPassedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;
        const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;
        
        let dmEmbed;
        if (newStatus === 'approved') {
            if (quizPassedRoleId) await candidate.roles.remove(quizPassedRoleId).catch(console.error);
            if (recruitRoleId) await candidate.roles.add(recruitRoleId).catch(console.error);
            dmEmbed = new EmbedBuilder().setColor('Green').setTitle('🎉 Alistamento Aprovado!').setDescription('Parabéns! A sua ficha foi aprovada e você foi oficialmente recrutado.');
        } else { // rejected
            if (quizPassedRoleId) await candidate.roles.remove(quizPassedRoleId).catch(console.error);
            dmEmbed = new EmbedBuilder().setColor('Red').setTitle('❌ Alistamento Recusado').setDescription('Infelizmente, a sua ficha foi recusada. Agradecemos o seu interesse.');
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
        
        await interaction.editReply({ embeds: [originalEmbed], components: [] });
    }
};

module.exports = enlistmentHandler;