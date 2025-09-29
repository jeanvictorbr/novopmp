const { EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');

async function dashboardMonitor(client) {
    try {
        const sessions = await db.all('SELECT * FROM patrol_sessions');
        if (sessions.length === 0) return;

        const settings = await db.all('SELECT * FROM settings');
        const settingsMap = new Map(settings.map(s => [s.key, s.value]));
        const footerText = settingsMap.get('copom_footer_text') || 'Police Flow - By Zépiqueno';
        const footerIconUrl = settingsMap.get('copom_footer_icon_url');
        const footerOptions = { text: footerText };
        if (footerIconUrl) footerOptions.iconURL = footerIconUrl;

        for (const session of sessions) {
            if (!session.dashboard_message_id || !session.dashboard_channel_id) continue;

            const guild = client.guilds.cache.first();
            if (!guild) continue;
            
            const teamChannel = await guild.channels.fetch(session.team_channel_id).catch(() => null);
            if (!teamChannel) continue;
            
            const member = await guild.members.fetch(session.user_id).catch(() => null);
            if (!member) continue;

            const now = Math.floor(Date.now() / 1000);
            let totalTimeSeconds = now - session.start_time;
            if (session.status === 'paused') {
                totalTimeSeconds = (session.last_pause_start_time - session.start_time) + session.total_pause_duration;
            } else if (session.total_pause_duration > 0) {
                totalTimeSeconds = (now - session.start_time) - session.total_pause_duration;
            }

            const hours = Math.floor(totalTimeSeconds / 3600);
            const minutes = Math.floor((totalTimeSeconds % 3600) / 60);
            const seconds = totalTimeSeconds % 60;
            const formattedDuration = `${hours}h ${minutes}m ${seconds}s`;
            
            const membersInCall = teamChannel.members.map(m => `<@${m.id}>`).join('\n') || '`Ninguém na call`';
            const isInCall = member.voice.channel && member.voice.channel.id === session.team_channel_id;

            let description = `**Equipe:** ${teamChannel}\n\nUse os botões para interagir com sua patrulha.`;
            if (!isInCall) {
                description += `\n\n⚠️ **ENTRE NA CALL DA EQUIPE CLICANDO ACIMA**`;
            }

            const messageChannel = await guild.channels.fetch(session.dashboard_channel_id).catch(() => null);
            if (!messageChannel) continue;
            
            const message = await messageChannel.messages.fetch(session.dashboard_message_id).catch(() => null);
            if (!message) continue;

            const updatedEmbed = new EmbedBuilder(message.embeds[0].toJSON())
                .setDescription(description)
                .setFields(
                    { name: 'Membros na Equipe', value: membersInCall, inline: false },
                    { name: 'Tempo de Serviço', value: `\`${formattedDuration}\``, inline: true },
                    { name: 'Status', value: `\`${session.status === 'paused' ? 'Pausado' : 'Em Patrulha'}\``, inline: true }
                )
                .setFooter(footerOptions);

            await message.edit({ embeds: [updatedEmbed] }).catch(console.error);
        }
    } catch (error) {
        console.error(`Falha ao atualizar dashboard do usuário:`, error);
    }
}

module.exports = { dashboardMonitor };