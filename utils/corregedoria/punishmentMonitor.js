const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js');

async function punishmentMonitor(client) {
    const nowInSeconds = Math.floor(Date.now() / 1000);

    try {
        const allActivePunishments = await db.all('SELECT * FROM active_punishments');
        if (allActivePunishments.length === 0) return;

        const expiredPunishments = allActivePunishments.filter(p => Number(p.expires_at) <= nowInSeconds);
        if (expiredPunishments.length === 0) return;

        console.log(`[PUNISHMENT MONITOR] PROCESSANDO ${expiredPunishments.length} PUNIÇÕES EXPIRADAS...`);
        const logChannelId = (await db.get("SELECT value FROM settings WHERE key = 'corregedoria_logs_channel_id'"))?.value;
        const logChannel = logChannelId ? await client.channels.fetch(logChannelId).catch(() => null) : null;

        for (const punishment of expiredPunishments) {
            const sanction = await db.get('SELECT * FROM corregedoria_sanctions WHERE sanction_id = $1', [punishment.sanction_id]);
            if (!sanction) continue;

            const guild = await client.guilds.fetch(punishment.guild_id).catch(() => null);
            if (!guild) {
                await db.run('DELETE FROM active_punishments WHERE sanction_id = $1', [punishment.sanction_id]);
                continue;
            }

            const member = await guild.members.fetch(punishment.user_id).catch(() => null);
            const role = await guild.roles.fetch(punishment.role_id).catch(() => null);

            if (member && role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role, 'Punição temporária expirada.');
            }

            await db.run('DELETE FROM active_punishments WHERE sanction_id = $1', [punishment.sanction_id]);
            
            // NOVO: Edita a mensagem de log original para mostrar "Expirada"
            if (sanction.log_message_id && sanction.log_channel_id) {
                try {
                    const originalLogChannel = await client.channels.fetch(sanction.log_channel_id);
                    const originalLogMessage = await originalLogChannel.messages.fetch(sanction.log_message_id);
                    if (originalLogMessage && originalLogMessage.embeds.length > 0) {
                        const originalEmbed = new EmbedBuilder(originalLogMessage.embeds[0].toJSON());
                        const expiraFieldIndex = originalEmbed.data.fields.findIndex(f => f.name === 'Expira');
                        if (expiraFieldIndex !== -1) {
                            originalEmbed.spliceFields(expiraFieldIndex, 1, { name: 'Status', value: `✅ Expirada` });
                            originalEmbed.setColor('Green');
                            await originalLogMessage.edit({ embeds: [originalEmbed] });
                        }
                    }
                } catch (editError) {
                    console.error(`[PUNISHMENT MONITOR] Falha ao editar a mensagem de log original (${sanction.log_message_id}):`, editError);
                }
            }

            // MANTIDO: Envia uma nova log informando que a punição foi removida
            if (logChannel) {
                const confirmationEmbed = new EmbedBuilder().setColor('Green').setTitle('✅ Punição Finalizada (Automático)').addFields({ name: 'Oficial', value: member ? member.toString() : `\`${punishment.user_id}\``, inline: true },{ name: 'Cargo Removido', value: role ? role.toString() : `\`${punishment.role_id}\``, inline: true },{ name: 'Tipo de Sanção', value: `\`${sanction.sanction_type}\`` },{ name: 'Data de Finalização', value: `<t:${nowInSeconds}:F>` }).setTimestamp();
                await logChannel.send({ embeds: [confirmationEmbed] });
            }
        }
    } catch (error) {
        console.error("[PUNISHMENT MONITOR] Erro crítico durante a verificação:", error);
    }
}

module.exports = { punishmentMonitor };