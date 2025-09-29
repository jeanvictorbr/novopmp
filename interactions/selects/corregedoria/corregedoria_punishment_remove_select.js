const db = require('../../../database/db.js');
const { getCorregedoriaPunishmentsMenuPayload } = require('../../../views/setup_views.js');

module.exports = {
    customId: 'corregedoria_punishment_remove_select',
    async execute(interaction) {
        await interaction.deferUpdate();
        const punishmentNameToRemove = interaction.values[0];

        try {
            // 1. Busca a punição para pegar o ID do cargo antes de deletar
            const punishment = await db.get('SELECT role_id FROM corregedoria_punishments WHERE name = $1', [punishmentNameToRemove]);

            // 2. Deleta a punição do banco de dados
            await db.run('DELETE FROM corregedoria_punishments WHERE name = $1', [punishmentNameToRemove]);

            // 3. ATUALIZAÇÃO: Se encontrou um cargo, deleta ele do Discord
            if (punishment && punishment.role_id) {
                const role = await interaction.guild.roles.fetch(punishment.role_id).catch(() => null);
                if (role) {
                    await role.delete(`Punição pré-definida "${punishmentNameToRemove}" removida por ${interaction.user.tag}.`);
                }
            }

            const payload = await getCorregedoriaPunishmentsMenuPayload(db);
            await interaction.editReply({ content: `✅ Punição **"${punishmentNameToRemove}"** e seu cargo associado foram removidos com sucesso.`, ...payload });

        } catch (error) {
            console.error("Erro ao remover punição:", error);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao tentar remover a punição.', ephemeral: true });
        }
    }
};