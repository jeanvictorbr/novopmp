const db = require('../database/db.js');

/**
 * Atualiza o nickname de um membro com base no seu cargo mais alto que possui uma tag configurada.
 * @param {import('discord.js').GuildMember} member O membro que teve os cargos atualizados.
 * @returns {Promise<boolean|string>} Retorna `true` se o nick foi alterado, `false` se não houve mudança, e 'PERMISSION_ERROR' se falhou por falta de permissão.
 */
async function updateMemberTag(member) {
    if (member.id === member.guild.ownerId || member.user.bot) {
        return false; // Não faz nada com o dono ou outros bots.
    }

    try {
        const tagConfigs = await db.all('SELECT role_id, tag FROM role_tags');
        if (tagConfigs.length === 0) return false;

        let highestRoleWithTag = null;
        let highestRolePosition = -1;

        for (const role of member.roles.cache.values()) {
            const config = tagConfigs.find(t => t.role_id === role.id);
            if (config && role.position > highestRolePosition) {
                highestRoleWithTag = config;
                highestRolePosition = role.position;
            }
        }

        const currentNickname = member.nickname || member.user.displayName;
        let newNickname = currentNickname;

        const oldTagMatch = currentNickname.match(/^\[.*?\]\s/);
        const baseName = oldTagMatch ? currentNickname.replace(oldTagMatch[0], '') : currentNickname;

        if (highestRoleWithTag) {
            const newTag = `[${highestRoleWithTag.tag}] `;
            newNickname = newTag + baseName;
        } else {
            newNickname = baseName;
        }

        if (newNickname.length > 32) {
            const tagPart = highestRoleWithTag ? `[${highestRoleWithTag.tag}] ` : '';
            const availableLength = 32 - tagPart.length;
            const truncatedBaseName = baseName.substring(0, availableLength).trim();
            newNickname = tagPart + truncatedBaseName;
        }
        
        if (member.nickname !== newNickname) {
            await member.setNickname(newNickname, 'Atualização automática de tag hierárquica.');
            return true; // Sucesso, houve alteração.
        }

        return false; // Sucesso, mas sem alteração.

    } catch (error) {
        if (error.code === 50013) { 
            console.warn(`[TAGS] Permissão negada para alterar o nickname de ${member.user.tag}. (Cargo superior)`);
            return 'PERMISSION_ERROR'; // Retorna o status de erro de permissão.
        } else {
            console.error(`[TAGS] Erro ao tentar atualizar a tag para ${member.user.tag}:`, error);
            return false;
        }
    }
}

module.exports = { updateMemberTag };