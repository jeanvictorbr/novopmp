const db = require('../../../database/db.js'); // Caminho corrigido

module.exports = {
    customId: 'decorations_remove_medal_select',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const medalId = interaction.values[0];
        try {
            const medal = await db.get('SELECT name, role_id FROM decorations_medals WHERE medal_id = $1', [medalId]);
            if (medal && medal.role_id) {
                const role = await interaction.guild.roles.fetch(medal.role_id).catch(() => null);
                if (role) await role.delete(`Medalha "${medal.name}" removida.`);
            }
            await db.run('DELETE FROM decorations_medals WHERE medal_id = $1', [medalId]);
            // CORREÇÃO: Apenas confirma a ação, não tenta editar o painel.
            await interaction.editReply({ content: `✅ Medalha **${medal.name}** removida. O painel será atualizado quando você voltar.` });
        } catch (error) {
            console.error("Erro ao remover medalha:", error);
        }
    }
};