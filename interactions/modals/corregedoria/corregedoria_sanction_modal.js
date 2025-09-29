const { EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');
const { logCorregedoriaEvent } = require('../../../utils/corregedoria/eventLogger.js');
const { updateCorregedoriaDashboard } = require('../../../utils/corregedoria/dashboardUpdater.js');

module.exports = {
    customId: (customId) => customId.startsWith('corregedoria_sanction_modal_'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const parts = interaction.customId.split('_');
            const ticketId = parts[3];
            const sanctionedUserId = parts[4];
            const sanctionType = decodeURIComponent(parts[5]);
            const reason = interaction.fields.getTextInputValue('sanction_reason');
            
            const memberToSanction = await interaction.guild.members.fetch(sanctionedUserId).catch(() => null);
            if (!memberToSanction) return await interaction.editReply({ content: '❌ O membro a ser punido não foi encontrado.' });

            const appliedAt = Math.floor(Date.now() / 1000);
            const finalTicketId = ticketId === '0' ? null : ticketId;

            const sanctionResult = await db.run('INSERT INTO corregedoria_sanctions (ticket_id, sanctioned_user_id, sanction_type, reason, applied_by, applied_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING sanction_id', [finalTicketId, sanctionedUserId, sanctionType, reason, interaction.user.id, appliedAt]);
            const newSanctionId = sanctionResult.rows[0].sanction_id;
            
            let expiresAt = 0;
            const punishmentDetails = await db.get('SELECT role_id, duration_seconds FROM corregedoria_punishments WHERE name = $1', [sanctionType]);
            
            if (punishmentDetails && punishmentDetails.role_id) {
                const role = await interaction.guild.roles.fetch(punishmentDetails.role_id).catch(() => null);
                if (role) {
                    await memberToSanction.roles.add(role, `Sanção aplicada por ${interaction.user.tag}`);
                    const durationInSeconds = Number(punishmentDetails.duration_seconds);
                    if (durationInSeconds > 0) {
                        expiresAt = appliedAt + durationInSeconds;
                        await db.run('INSERT INTO active_punishments (user_id, guild_id, role_id, sanction_id, expires_at) VALUES ($1, $2, $3, $4, $5)', [sanctionedUserId, interaction.guild.id, role.id, newSanctionId, expiresAt]);
                    }
                }
            }
            
            const logEmbed = new EmbedBuilder().setColor(finalTicketId ? 'DarkOrange' : 'Red').setTitle(finalTicketId ? '⚖️ Veredito e Sanção Aplicada' : '⚖️ Sanção Direta Aplicada').setThumbnail(memberToSanction.user.displayAvatarURL()).addFields({ name: 'Oficial Punido', value: memberToSanction.toString(), inline: true },{ name: 'Punição Aplicada', value: `**${sanctionType}**`, inline: true },{ name: 'Aplicado por', value: interaction.user.toString() },{ name: 'Justificativa', value: reason },{ name: 'Data', value: `<t:${appliedAt}:F>` }).setTimestamp();
            if (expiresAt > 0) {
                logEmbed.addFields({ name: 'Expira', value: `<t:${expiresAt}:R>` });
            }

            let logMessage;
            if (finalTicketId) {
                logEmbed.setFooter({ text: `Sanção ID: ${newSanctionId} • Ticket ID: ${ticketId}` });
                logMessage = await interaction.channel.send({ embeds: [logEmbed] });
                await logCorregedoriaEvent(ticketId, 'sancao_aplicada', `Uma sanção de **${sanctionType}** foi aplicada a <@${sanctionedUserId}>.`, interaction.user.id);
                await updateCorregedoriaDashboard(interaction, ticketId);
            } else {
                const logChannelId = (await db.get("SELECT value FROM settings WHERE key = 'corregedoria_logs_channel_id'"))?.value;
                if (logChannelId) {
                    const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
                    if (logChannel) logMessage = await logChannel.send({ embeds: [logEmbed] });
                }
            }
            
            // NOVO: Salva o ID da mensagem de log no banco de dados para edição futura
            if (logMessage) {
                await db.run('UPDATE corregedoria_sanctions SET log_channel_id = $1, log_message_id = $2 WHERE sanction_id = $3', [logMessage.channel.id, logMessage.id, newSanctionId]);
            }

            await interaction.editReply({ content: '✅ Sanção aplicada e registrada com sucesso!', ephemeral: true });

        } catch (error) {
            console.error("Erro ao aplicar sanção:", error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao registrar a sanção. Verifique o console.', ephemeral: true });
        }
    }
};