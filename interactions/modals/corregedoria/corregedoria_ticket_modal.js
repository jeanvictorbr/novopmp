const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const db = require('../../../database/db.js');
const { updateCorregedoriaDashboard } = require('../../../utils/corregedoria/dashboardUpdater.js');
const { logCorregedoriaEvent } = require('../../../utils/corregedoria/eventLogger.js');

module.exports = {
    customId: 'corregedoria_ticket_modal',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const accusedMember = interaction.fields.getTextInputValue('accused_member');
            const description = interaction.fields.getTextInputValue('report_description');
            const evidence = interaction.fields.getTextInputValue('report_evidence');

            const settings = await db.all("SELECT key, value FROM settings WHERE key LIKE 'corregedoria_%'");
            const settingsMap = new Map(settings.map(s => [s.key, s.value]));
            const corregedorRoleId = settingsMap.get('corregedoria_role_id');
            const ticketsCategoryId = settingsMap.get('corregedoria_tickets_category_id');
            const logChannelId = settingsMap.get('corregedoria_logs_channel_id');
            if (!corregedorRoleId || !ticketsCategoryId || !logChannelId) {
                return await interaction.editReply('❌ O sistema de corregedoria ainda não foi totalmente configurado.');
            }
            const sanitizedUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 25) || 'denuncia';
            const ticketChannel = await interaction.guild.channels.create({ name: `denuncia-${sanitizedUsername}`, type: ChannelType.GuildText, parent: ticketsCategoryId, permissionOverwrites: [ { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, { id: corregedorRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages] }, { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] } ], });
            const createdAt = Math.floor(Date.now() / 1000);
            const result = await db.run('INSERT INTO corregedoria_tickets (guild_id, channel_id, complainant_id, accused_info, description, evidence, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ticket_id', [interaction.guild.id, ticketChannel.id, interaction.user.id, accusedMember, description, evidence, createdAt] );
            const ticketId = result.rows[0].ticket_id;

            const ticketEmbed = new EmbedBuilder() .setColor('Red') .setTitle(`🚨 Nova Denúncia Registrada`) .setThumbnail(interaction.user.displayAvatarURL()) .addFields( { name: '👤 Denunciante', value: interaction.user.toString(), inline: true }, { name: '🆔 Ticket ID', value: `\`${ticketId}\``, inline: true }, { name: ' Acusado(s)', value: `\`\`\`${accusedMember}\`\`\`` }, { name: '📄 Descrição da Ocorrência', value: `\`\`\`${description}\`\`\`` }, { name: ' evidentiary material', value: `\`\`\`${evidence}\`\`\`` }, { name: '🕵️ Investigador Responsável', value: '`Aguardando reivindicação...`' } ) .setTimestamp(createdAt * 1000) .setFooter({ text: 'A confidencialidade da sua denúncia está assegurada.' });
            const managementButtons = new ActionRowBuilder().addComponents( new ButtonBuilder().setCustomId('corregedoria_claim_ticket').setLabel('Reivindicar').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'), new ButtonBuilder().setCustomId('corregedoria_manage_users').setLabel('Gerenciar Membros').setStyle(ButtonStyle.Secondary).setEmoji('👤'), new ButtonBuilder().setCustomId('corregedoria_apply_sanction').setLabel('Aplicar Sanção').setStyle(ButtonStyle.Primary).setEmoji('⚖️'), new ButtonBuilder().setCustomId(`corregedoria_finalize_ticket_${ticketId}`).setLabel('Finalizar Denúncia').setStyle(ButtonStyle.Danger).setEmoji('🗑️') );
            const welcomeMessage = `Olá, ${interaction.user.toString()}. Sua denúncia foi recebida. Enquanto um corregedor assume o caso, sinta-se à vontade para adicionar qualquer informação ou prova adicional que julgar necessária.`;
            await ticketChannel.send({ content: `Atenção, <@&${corregedorRoleId}>! Uma nova denúncia foi registrada.\n\n${welcomeMessage}`, embeds: [ticketEmbed], components: [managementButtons] });
            
            // Registrar evento e criar/atualizar dashboard
            await logCorregedoriaEvent(ticketId, 'aberto', `O ticket foi aberto por <@${interaction.user.id}>.`, interaction.user.id);
            await updateCorregedoriaDashboard(interaction, ticketId);

            await interaction.editReply(`✅ Sua denúncia foi registrada com sucesso no canal ${ticketChannel}.`);
        } catch (error) {
            console.error("Erro ao processar modal de denúncia:", error);
            await interaction.editReply('❌ Ocorreu um erro crítico ao registrar sua denúncia.');
        }
    },
};