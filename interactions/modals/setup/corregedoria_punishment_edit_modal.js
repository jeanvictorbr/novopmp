const db = require('../../../database/db.js');
const { getCorregedoriaPunishmentsMenuPayload } = require('../../../views/setup_views.js');
const { parseDuration } = require('../../../utils/timeUtils.js');

module.exports = {
    customId: (customId) => customId.startsWith('corregedoria_punishment_edit_modal_'),
    async execute(interaction) {
        await interaction.deferUpdate();

        const oldPunishmentName = decodeURIComponent(interaction.customId.replace('corregedoria_punishment_edit_modal_', ''));

        try {
            const newName = interaction.fields.getTextInputValue('punishment_name');
            const description = interaction.fields.getTextInputValue('punishment_description');
            const durationStr = interaction.fields.getTextInputValue('punishment_duration');

            const durationSeconds = parseDuration(durationStr);
            if (durationSeconds === null) {
                return await interaction.followUp({ content: '❌ Formato de duração inválido. Use (m)inutos, (h)oras ou (d)ias (ex: `30m`, `12h`, `7d`).', ephemeral: true });
            }

            const oldPunishment = await db.get('SELECT * FROM corregedoria_punishments WHERE name = $1', [oldPunishmentName]);

            await db.run(
                'UPDATE corregedoria_punishments SET name = $1, description = $2, duration_seconds = $3 WHERE name = $4',
                [newName, description, durationSeconds, oldPunishmentName]
            );

            if (oldPunishment.name !== newName && oldPunishment.role_id) {
                const role = await interaction.guild.roles.fetch(oldPunishment.role_id).catch(() => null);
                if (role) {
                    await role.setName(`Punição: ${newName}`, 'Nome da punição editado via painel.');
                }
            }
            
            const payload = await getCorregedoriaPunishmentsMenuPayload(db);
            await interaction.editReply({ content: `✅ Punição **"${newName}"** atualizada com sucesso.`, ...payload });

        } catch (error) {
            console.error("Erro ao editar punição:", error);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao salvar as alterações.', ephemeral: true });
        }
    }
};