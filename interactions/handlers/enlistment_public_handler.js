// Local: interactions/handlers/enlistment_public_handler.js
// (Este arquivo está correto, não precisa de alterações da última versão, mas substitua-o para garantir a integridade)

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db.js');

module.exports = {
    customId: (id) => id.startsWith('enlistment_'),

    async execute(interaction) {
        const [action, ...args] = interaction.customId.split('_');
        try {
            if (action === 'start' && args.join('_') === 'process') return await this.handleStartProcess(interaction);
            if (interaction.isModalSubmit() && interaction.customId === 'enlistment_apply_modal') return await this.handleEnlistmentModal(interaction);
            if (action === 'approve') return await this.handleApproval(interaction, 'approved');
            if (action === 'reject') return await this.handleApproval(interaction, 'rejected');
        } catch (error) { console.error(`Erro no handler público de alistamento:`, error); }
    },
    async handleStartProcess(interaction) {
        const activeQuizId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_id'"))?.value;
        if (activeQuizId) {
            const quizPassedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;
            if (!quizPassedRoleId || !interaction.member.roles.cache.has(quizPassedRoleId)) {
                return interaction.reply({ content: '❌ Você precisa primeiro ser aprovado na prova teórica para se alistar.', ephemeral: true });
            }
        }
        const existingRequest = await db.get('SELECT * FROM enlistment_requests WHERE user_id = $1 AND status = $2', [interaction.user.id, 'pending']);
        if (existingRequest) return interaction.reply({ content: `❌ Você já possui uma ficha em análise.`, ephemeral: true });

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
        if (!approvalChannelId || !recruiterRoleId) return interaction.editReply({ content: '❌ O sistema está com configurações pendentes.' });

        const result = await db.run('INSERT INTO enlistment_requests (user_id, rp_name, game_id, request_date, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO UPDATE SET rp_name = $2, game_id = $3, request_date = $4, status = $5 RETURNING request_id', [interaction.user.id, rpName, gameId, Math.floor(Date.now() / 1000), 'pending']);
        const requestId = result.rows[0].request_id;
        
        const channel = await interaction.guild.channels.fetch(approvalChannelId);
        const embed = new EmbedBuilder().setColor('Yellow').setTitle('📝 Nova Ficha para Análise').setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .addFields({ name: 'Candidato', value: interaction.user.toString() }, { name: 'Nome (RP)', value: `\`${rpName}\`` }, { name: 'ID (Jogo)', value: `\`${gameId}\`` });
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`enlistment_approve_${requestId}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`enlistment_reject_${requestId}`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
        );
        await channel.send({ content: `Atenção, <@&${recruiterRoleId}>!`, embeds: [embed], components: [buttons] });
        await interaction.editReply({ content: '✅ Sua ficha foi enviada para análise! Você será notificado sobre o resultado final.', components: [] });
    },
    async handleApproval(interaction, newStatus) {
        await interaction.deferUpdate();
        const requestId = interaction.customId.split('_').pop();
        const request = await db.get('SELECT * FROM enlistment_requests WHERE request_id = $1', [requestId]);
        if (!request || request.status !== 'pending') return;

        const candidate = await interaction.guild.members.fetch(request.user_id).catch(() => null);
        if (!candidate) {
            await db.run('DELETE FROM enlistment_requests WHERE request_id = $1', [requestId]);
            return interaction.editReply({ content: 'Candidato não encontrado. Ficha removida.', components: [], embeds: [] });
        }
        await db.run('UPDATE enlistment_requests SET status = $1, recruiter_id = $2 WHERE request_id = $3', [newStatus, interaction.user.id, requestId]);
        
        const quizPassedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;
        if (quizPassedRoleId) await candidate.roles.remove(quizPassedRoleId).catch(console.error);

        let embedDescription;
        if (newStatus === 'approved') {
            embedDescription = 'Parabéns! Sua ficha foi aprovada e você foi oficialmente recrutado.';
            const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;
            if (recruitRoleId) await candidate.roles.add(recruitRoleId).catch(console.error);
        } else {
            embedDescription = 'Infelizmente, sua ficha foi recusada. Agradecemos o seu interesse.';
        }
        try {
            await candidate.send({ embeds: [new EmbedBuilder().setColor(newStatus === 'approved' ? 'Green' : 'Red').setTitle(newStatus === 'approved' ? '🎉 Alistamento Concluído!' : '❌ Alistamento Recusado').setDescription(embedDescription).setFooter({ text: `Analisado por: ${interaction.user.tag}` })] });
        } catch (e) {}
        
        const originalEmbed = new EmbedBuilder(interaction.message.embeds[0].toJSON()).setColor(newStatus === 'approved' ? 'Green' : 'Red').setTitle(`Ficha ${newStatus === 'approved' ? 'Aprovada' : 'Recusada'}`).setFooter({ text: `Decisão de ${interaction.user.tag}` });
        await interaction.editReply({ embeds: [originalEmbed], components: [] });
    }
};