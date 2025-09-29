const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db.js');

async function updateCorregedoriaDashboard(interaction, ticketId) {
    try {
        const logChannelId = (await db.get("SELECT value FROM settings WHERE key = 'corregedoria_logs_channel_id'"))?.value;
        if (!logChannelId) return;

        const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        const ticket = await db.get('SELECT * FROM corregedoria_tickets WHERE ticket_id = $1', [ticketId]);
        const events = await db.all('SELECT * FROM corregedoria_events WHERE ticket_id = $1 ORDER BY created_at ASC', [ticketId]);
        const complainantUser = await interaction.client.users.fetch(ticket.complainant_id).catch(() => null);

        let statusText = '🔴 `ABERTO`';
        let color = 'Red';
        if (ticket.status === 'finalizado') {
            statusText = '✅ `FINALIZADO`';
            color = 'Green';
        } else if (ticket.investigator_id) {
            statusText = `🔵 \`EM INVESTIGAÇÃO\``;
            color = 'Blue';
        }

        const eventsDescription = events.map(e => `> <t:${e.created_at}:T> - ${e.event_description}`).join('\n');

        const dashboardEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`⚖️ Acompanhamento do Ticket ID: ${ticket.ticket_id}`)
            .setThumbnail(complainantUser ? complainantUser.displayAvatarURL() : null)
            .addFields(
                { name: 'Status do Processo', value: statusText },
                { name: 'Denunciante', value: `<@${ticket.complainant_id}>`, inline: true },
                { name: 'Canal do Ticket', value: `<#${ticket.channel_id}>`, inline: true },
                { name: 'Histórico de Ações', value: eventsDescription || '`Nenhuma ação registrada ainda.`' }
            )
            .setTimestamp()
            .setFooter({ text: `Última atualização` });

        const sanctions = await db.all('SELECT * FROM corregedoria_sanctions WHERE ticket_id = $1 ORDER BY applied_at ASC', [ticketId]);
        if (sanctions.length > 0) {
            const sanctionsText = sanctions.map(s => `**- Tipo:** ${s.sanction_type}\n  **Oficial:** <@${s.sanctioned_user_id}>`).join('\n\n');
            dashboardEmbed.addFields({ name: 'Vereditos e Sanções Aplicadas', value: sanctionsText });
        }
        
        // **LÓGICA PARA ADICIONAR O BOTÃO DE TRANSCRIPT**
        const components = [];
        if (ticket.status === 'finalizado' && ticket.transcript_message_url) {
            const transcriptButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Ver Transcript')
                    .setStyle(ButtonStyle.Link)
                    .setURL(ticket.transcript_message_url)
                    .setEmoji('📄')
            );
            components.push(transcriptButton);
        }

        if (ticket.log_message_id) {
            const message = await logChannel.messages.fetch(ticket.log_message_id).catch(() => null);
            if (message) {
                await message.edit({ embeds: [dashboardEmbed], components: components });
            }
        } else {
            const message = await logChannel.send({ embeds: [dashboardEmbed], components: components });
            await db.run('UPDATE corregedoria_tickets SET log_message_id = $1 WHERE ticket_id = $2', [message.id, ticketId]);
        }

    } catch (error) {
        console.error("Erro ao atualizar o dashboard da corregedoria:", error);
    }
}

module.exports = { updateCorregedoriaDashboard };