const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../database/db.js');
const { updateCorregedoriaDashboard } = require('../../../utils/corregedoria/dashboardUpdater.js');
const { logCorregedoriaEvent } = require('../../../utils/corregedoria/eventLogger.js');

module.exports = {
    customId: 'corregedoria_claim_ticket',
    async execute(interaction) {
        await interaction.deferUpdate();

        try {
            const ticket = await db.get('SELECT * FROM corregedoria_tickets WHERE channel_id = $1', [interaction.channel.id]);
            if (!ticket) {
                return interaction.followUp({ content: '❌ Este ticket não foi encontrado no banco de dados.', ephemeral: true });
            }

            const originalEmbed = interaction.message.embeds[0];
            const updatedEmbed = new EmbedBuilder(originalEmbed.toJSON())
                .setFields(
                    ...originalEmbed.fields.filter(field => field.name !== '🕵️ Investigador Responsável'),
                    { name: '🕵️ Investigador Responsável', value: `O caso está sendo tratado por ${interaction.user.toString()}.` }
                );

            const updatedButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('corregedoria_claim_ticket').setLabel('Ticket Reivindicado').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️').setDisabled(true),
                new ButtonBuilder().setCustomId('corregedoria_manage_users').setLabel('Gerenciar Membros').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
                new ButtonBuilder().setCustomId('corregedoria_apply_sanction').setLabel('Aplicar Sanção').setStyle(ButtonStyle.Primary).setEmoji('⚖️'),
                new ButtonBuilder().setCustomId(`corregedoria_finalize_ticket_${ticket.ticket_id}`).setLabel('Finalizar Denúncia').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );
            
            await interaction.editReply({ embeds: [updatedEmbed], components: [updatedButtons] });
            await interaction.channel.send({ content: `✅ Este ticket foi reivindicado por ${interaction.user.toString()}. Ele agora é o principal responsável pela investigação.` });

            await db.run('UPDATE corregedoria_tickets SET investigator_id = $1 WHERE ticket_id = $2', [interaction.user.id, ticket.ticket_id]);
            
            await logCorregedoriaEvent(ticket.ticket_id, 'reivindicado', `O caso foi reivindicado por <@${interaction.user.id}>.`, interaction.user.id);
            await updateCorregedoriaDashboard(interaction, ticket.ticket_id);

        } catch (error) {
            console.error("Erro ao reivindicar ticket:", error);
        }
    }
};