// Local: interactions/handlers/enlistment_public_handler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db.js');

module.exports = {
    customId: (id) => id.startsWith('enlistment_') && !id.startsWith('enlistment_setup_'), // Pega tudo de alistamento MENOS o setup

    async execute(interaction) {
        const action = interaction.customId.split('_')[1];

        try {
            if (action === 'start') return await this.showEnlistmentModal(interaction);
            if (interaction.isModalSubmit() && interaction.customId === 'enlistment_apply_modal') return await this.handleEnlistmentModal(interaction);
            if (action === 'approve') return await this.handleApproval(interaction, 'approved');
            if (action === 'reject') return await this.handleApproval(interaction, 'rejected');

        } catch (error) { console.error(`Erro no handler público de alistamento:`, error); }
    },

    async showEnlistmentModal(interaction) {
        const existingRequest = await db.get('SELECT * FROM enlistment_requests WHERE user_id = $1', [interaction.user.id]);
        if(existingRequest) {
            return interaction.reply({content: `❌ Você já possui uma ficha de alistamento em andamento (Status: \`${existingRequest.status}\`).`, ephemeral: true});
        }
        const modal = new ModalBuilder().setCustomId('enlistment_apply_modal').setTitle('Formulário de Alistamento');
        const nameInput = new TextInputBuilder().setCustomId('rp_name').setLabel("Nome Completo (RP)").setStyle(TextInputStyle.Short).setRequired(true);
        const idInput = new TextInputBuilder().setCustomId('game_id').setLabel("Seu ID (no jogo)").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(idInput));
        await interaction.showModal(modal);
    },

    async handleEnlistmentModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const rpName = interaction.fields.getTextInputValue('rp_name');
        const gameId = interaction.fields.getTextInputValue('game_id');
        const recruiterRoleId = (await db.get("SELECT value FROM settings WHERE key = 'recruiter_role_id'"))?.value;

        if (!recruiterRoleId) return await interaction.editReply('❌ O sistema de alistamento está temporariamente desativado. (Cargo de recrutador não configurado).');

        const approvalChannelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_approval_channel_id'"))?.value;
        if (!approvalChannelId) return await interaction.editReply('❌ O sistema de alistamento está temporariamente desativado. (Canal de aprovação não configurado).');

        const result = await db.run('INSERT INTO enlistment_requests (user_id, rp_name, game_id, request_date) VALUES ($1, $2, $3, $4) RETURNING request_id', [interaction.user.id, rpName, gameId, Math.floor(Date.now() / 1000)]);
        const requestId = result.rows[0].request_id;

        const channel = await interaction.guild.channels.fetch(approvalChannelId);
        const embed = new EmbedBuilder().setColor('Yellow').setTitle('📝 Novo Pedido de Alistamento').setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
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
        await interaction.editReply({ content: '✅ Seu pedido de alistamento foi enviado para análise! Você será notificado sobre o resultado.', components: [] });
    },

    async handleApproval(interaction, newStatus) {
        await interaction.deferUpdate();
        const requestId = interaction.customId.split('_').pop();
        const request = await db.get('SELECT * FROM enlistment_requests WHERE request_id = $1', [requestId]);
        
        if (!request || request.status !== 'pending') return;

        const candidate = await interaction.guild.members.fetch(request.user_id).catch(() => null);
        if (!candidate) {
            await db.run('DELETE FROM enlistment_requests WHERE request_id = $1', [requestId]);
            return interaction.editReply({content: 'Candidato não encontrado no servidor. Ficha removida.', components: [], embeds: []});
        }
        
        const quizId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_id'"))?.value;
        const finalStatus = (newStatus === 'approved' && quizId) ? 'quiz_pending' : newStatus;
        
        await db.run('UPDATE enlistment_requests SET status = $1, recruiter_id = $2 WHERE request_id = $3', [finalStatus, interaction.user.id, requestId]);

        const embedColor = finalStatus === 'rejected' ? 'Red' : 'Green';
        const embedTitle = finalStatus === 'rejected' ? '❌ Alistamento Recusado' : '✅ Alistamento Aprovado';
        
        let dmDescription;
        const dmComponents = [];

        if (finalStatus === 'rejected') {
            dmDescription = 'O seu pedido de alistamento foi recusado. Você pode tentar novamente no futuro.';
        } else if (finalStatus === 'quiz_pending') {
            dmDescription = 'Parabéns, seu formulário foi pré-aprovado! A próxima etapa é uma prova teórica. Clique no botão abaixo para começar.';
            dmComponents.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`quiz_start_${request.user_id}_${quizId}`).setLabel('Iniciar Prova Teórica').setStyle(ButtonStyle.Primary)));
        } else { // Aprovado direto, sem prova
            dmDescription = 'Parabéns! O seu pedido de alistamento foi aprovado. Apresente-se no local designado para iniciar o seu treinamento.';
            const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;
            if(recruitRoleId) await candidate.roles.add(recruitRoleId).catch(console.error);
        }

        try {
            const dmEmbed = new EmbedBuilder().setColor(embedColor).setTitle(embedTitle).setDescription(dmDescription).setFooter({ text: `Analisado por: ${interaction.user.tag}` });
            await candidate.send({ embeds: [dmEmbed], components: dmComponents });
        } catch (e) {}

        const originalEmbed = new EmbedBuilder(interaction.message.embeds[0].toJSON())
            .setColor(embedColor)
            .setTitle(`Pedido de Alistamento ${finalStatus === 'rejected' ? 'Recusado' : 'Aprovado'}`)
            .setFooter({ text: `Decisão de ${interaction.user.tag}` });
        
        await interaction.editReply({ embeds: [originalEmbed], components: [] });
    }
};