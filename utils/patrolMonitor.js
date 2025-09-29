const { EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');
const { updateCopomPanel } = require('./updateCopomPanel.js');
const { dashboardMonitor } = require('./dashboardMonitor.js');

// Função para encerrar o serviço de um usuário (reutilizável)
async function endPatrolSession(guild, user, session, reason) {
    const endTime = Math.floor(Date.now() / 1000);

    let effectiveDuration = (endTime - session.start_time) - (session.total_pause_duration || 0);
    if (session.status === 'paused') {
        effectiveDuration -= (endTime - session.last_pause_start_time);
    }
    
    const hours = Math.floor(effectiveDuration / 3600);
    const minutes = Math.floor((effectiveDuration % 3600) / 60);
    const formattedDuration = `${hours}h ${minutes}m`;

    const settings = await db.all('SELECT * FROM settings');
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));
    const roleId = settingsMap.get('em_servico_role_id');
    const logsChannelId = settingsMap.get('copom_logs_channel_id');
    const footerText = settingsMap.get('copom_footer_text') || 'Police Flow - By Zépiqueno';
    const footerIconUrl = settingsMap.get('copom_footer_icon_url');
    
    // Remove o cargo e a sessão do banco de dados primeiro
    if (roleId) {
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (member) await member.roles.remove(roleId).catch(console.warn);
    }
    await db.run('DELETE FROM patrol_sessions WHERE user_id = $1', [user.id]);

    // Envia a mensagem final para o canal privado antes de deletá-lo
    if (session.private_channel_id) {
        const privateChannel = await guild.channels.fetch(session.private_channel_id).catch(() => null);
        if (privateChannel) {
            await privateChannel.send(`🔴 O seu ponto foi encerrado automaticamente. Duração: **${formattedDuration}**. Este canal será excluído em instantes.`).catch(console.error);
            // Exclui o canal temporário
            setTimeout(() => privateChannel.delete('Ponto encerrado e canal removido.').catch(console.error), 5000);
        }
    }

    if (logsChannelId && session.log_message_id) {
        const logsChannel = await guild.channels.fetch(logsChannelId).catch(() => null);
        const logMessage = logsChannel ? await logsChannel.messages.fetch(session.log_message_id).catch(() => null) : null;
        const teamChannel = await guild.channels.fetch(session.team_channel_id).catch(() => ({ name: 'Desconhecida' }));
        
        if (logMessage) {
            const footerOptions = { text: footerText };
            if (footerIconUrl) footerOptions.iconURL = footerIconUrl;
            
            const updatedEmbed = new EmbedBuilder(logMessage.embeds[0].toJSON())
                .setColor('DarkRed')
                .setTitle('🔴 Serviço Encerrado Automaticamente')
                .setFields(
                    { name: 'Oficial', value: `<@${user.id}>`, inline: false },
                    { name: 'Motivo', value: `\`${reason}\``, inline: false },
                    { name: 'Equipe', value: `\`${teamChannel.name}\``, inline: true },
                    { name: 'Duração Efetiva', value: `\`${formattedDuration}\``, inline: true }
                )
                .setFooter(footerOptions);
            await logMessage.edit({ embeds: [updatedEmbed] }).catch(console.error);
        }
    }
}

async function patrolMonitor(client) {
    try {
        const activeSessions = await db.all('SELECT * FROM patrol_sessions WHERE status = $1', ['active']);
        if (activeSessions.length === 0) return;

        const settings = await db.all('SELECT * FROM settings');
        const settingsMap = new Map(settings.map(s => [s.key, s.value]));
        const copomChannelId = settingsMap.get('copom_channel_id');
        if (!copomChannelId) return;

        const guild = client.guilds.cache.first();
        if (!guild) return;
        
        const copomChannel = await guild.channels.fetch(copomChannelId).catch(() => null);

        for (const session of activeSessions) {
            const member = await guild.members.fetch(session.user_id).catch(() => null);
            if (!member) {
                await db.run('DELETE FROM patrol_sessions WHERE user_id = $1', [session.user_id]);
                continue;
            }

            const isInCorrectChannel = member.voice.channel && member.voice.channel.id === session.team_channel_id;
            const now = Math.floor(Date.now() / 1000);

            if (!isInCorrectChannel) {
                if (session.warning_sent_at) {
                    const timeSinceWarning = now - session.warning_sent_at;
                    
                    if (timeSinceWarning >= 120) { // 2 minutos
                        await endPatrolSession(guild, member.user, session, 'Não retornou ao canal de voz da equipe.');
                        await updateCopomPanel(client);
                        await dashboardMonitor(client);
                    } else if (timeSinceWarning >= 100 && timeSinceWarning < 120) { // Contagem regressiva nos últimos 20 segundos
                         const remainingTime = 120 - timeSinceWarning;
                         const privateChannel = await guild.channels.fetch(session.private_channel_id).catch(() => null);
                         if (privateChannel) {
                             await privateChannel.send(`⚠️ **CONT. REGRESSIVA:** ${remainingTime} segundos para o ponto ser encerrado.`).catch(console.error);
                         }
                    }
                } else {
                    const warningTime = now;
                    await db.run('UPDATE patrol_sessions SET warning_sent_at = $1 WHERE user_id = $2', [warningTime, session.user_id]);
                    
                    const privateChannel = await guild.channels.fetch(session.private_channel_id).catch(() => null);
                    if (privateChannel) {
                         await privateChannel.send({ 
                            content: `⚠️ <@${member.user.id}>, você se desconectou do canal da sua equipe. **Retorne em 2 minutos ou seu ponto será encerrado automaticamente.**`,
                         }).catch(console.error);
                    }
                }
            } else if (isInCorrectChannel && session.warning_sent_at) {
                await db.run('UPDATE patrol_sessions SET warning_sent_at = NULL WHERE user_id = $1', [session.user.id]);
                const privateChannel = await guild.channels.fetch(session.private_channel_id).catch(() => null);
                if (privateChannel) {
                    await privateChannel.send({ content: '✅ Bem-vindo de volta, o aviso foi cancelado.' }).catch(console.error);
                }
            }
        }
    } catch (error) {
        console.error(`Falha no monitor de patrulha:`, error);
    }
}

module.exports = { patrolMonitor };