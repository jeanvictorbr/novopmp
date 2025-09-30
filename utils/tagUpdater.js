const db = require('../database/db.js');

/**
 * Atualiza o nickname de um membro com base no seu cargo mais alto que possui uma tag configurada.
 * @param {import('discord.js').GuildMember} member O membro que teve os cargos atualizados.
 */
async function updateMemberTag(member) {
    // Não tenta alterar o nickname do dono do servidor.
    if (member.id === member.guild.ownerId) return;
    // Não tenta alterar o nickname de outros bots para evitar conflitos.
    if (member.user.bot) return;

    try {
        const tagConfigs = await db.all('SELECT role_id, tag FROM role_tags');
        if (tagConfigs.length === 0) return;

        let highestRoleWithTag = null;
        let highestRolePosition = -1;

        // 1. Encontra o cargo mais alto do membro que tem uma tag configurada
        for (const role of member.roles.cache.values()) {
            const config = tagConfigs.find(t => t.role_id === role.id);
            if (config && role.position > highestRolePosition) {
                highestRoleWithTag = config;
                highestRolePosition = role.position;
            }
        }

        const currentNickname = member.nickname || member.user.displayName;
        let newNickname = currentNickname;

        // Remove qualquer tag antiga que o Phoenix tenha colocado
        const oldTagMatch = currentNickname.match(/^\[.*?\]\s/);
        const baseName = oldTagMatch ? currentNickname.replace(oldTagMatch[0], '') : currentNickname;

        // 2. Define o novo nickname
        if (highestRoleWithTag) {
            const newTag = `[${highestRoleWithTag.tag}] `;
            newNickname = newTag + baseName;
        } else {
            // Se o membro não tem mais nenhum cargo com tag, remove a tag antiga.
            newNickname = baseName;
        }

        // 3. Garante que o nickname não exceda 32 caracteres, truncando o nome base se necessário.
        if (newNickname.length > 32) {
            const tagPart = highestRoleWithTag ? `[${highestRoleWithTag.tag}] ` : '';
            const availableLength = 32 - tagPart.length;
            const truncatedBaseName = baseName.substring(0, availableLength);
            newNickname = tagPart + truncatedBaseName;
        }
        
        // 4. Altera o nickname apenas se houver uma mudança real, para evitar chamadas desnecessárias à API.
        if (member.nickname !== newNickname) {
            await member.setNickname(newNickname, 'Atualização automática de tag hierárquica.');
        }

    } catch (error) {
        // Ignora erros de "Missing Permissions", que são comuns se o bot tentar alterar o nick de um admin/dono.
        if (error.code === 50013) { 
            console.warn(`[TAGS] Permissão negada para alterar o nickname de ${member.user.tag}. (Cargo superior)`);
        } else {
            console.error(`[TAGS] Erro ao tentar atualizar a tag para ${member.user.tag}:`, error);
        }
    }
}

module.exports = { updateMemberTag };