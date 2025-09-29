const { EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');

async function hierarchyMonitor(client) {
    try {
        const settings = await db.all('SELECT key, value FROM settings');
        const settingsMap = new Map(settings.map(s => [s.key, s.value]));

        const channelId = settingsMap.get('hierarchy_channel_id');
        const messageId = settingsMap.get('hierarchy_message_id');
        if (!channelId || !messageId) return;

        const guild = client.guilds.cache.first();
        if (!guild) return;

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        const message = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;
        if (!message) return;

        await guild.roles.fetch();
        await guild.members.fetch();
        const hiddenRolesResult = await db.all('SELECT role_id FROM hierarchy_hidden_roles');
        const hiddenRoleIds = new Set(hiddenRolesResult.map(r => r.role_id));

        const visibleRoles = guild.roles.cache
            .filter(role => !hiddenRoleIds.has(role.id) && role.id !== guild.id)
            .sort((a, b) => b.position - a.position);

        const membersShown = new Set();
        let description = '';
        
        const tierEmojis = ['👑', '⭐', '🌟', '🔸', '🔹'];
        let roleCount = 0;

        visibleRoles.forEach(role => {
            const membersInRole = role.members
                .filter(member => !membersShown.has(member.id))
                .map(member => {
                    membersShown.add(member.id);
                    return member.toString();
                });

            if (membersInRole.length > 0) {
                const emoji = tierEmojis[Math.min(roleCount, tierEmojis.length - 1)];

                // CORREÇÃO: Nome do cargo agora dentro de `backticks`
                description += `\n${emoji} \`${role.name.toUpperCase()}\` (${membersInRole.length})\n`;
                
                // CORREÇÃO: Membros listados um embaixo do outro, usando .join('\n')
                description += `${membersInRole.join('\n')}\n`;
                
                roleCount++;
            }
        });

        if (!description) {
            description = 'Nenhum membro encontrado nos cargos visíveis.';
        }
        
        const title = settingsMap.get('hierarchy_title') || 'Hierarquia Oficial';
        const imageUrl = settingsMap.get('hierarchy_image_url');

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`📊 ${title}`)
            .setThumbnail(guild.iconURL())
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: 'Hierarquia atualizada em' });

        if (imageUrl) {
            embed.setImage(imageUrl);
        }

        await message.edit({ embeds: [embed] });

    } catch (error) {
        console.error("Erro no monitor de hierarquia:", error);
    }
}

module.exports = { hierarchyMonitor };