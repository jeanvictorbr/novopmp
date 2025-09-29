const { StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('dossie_edit_sanction_'),
    async execute(interaction) {
        const targetUserId = interaction.customId.split('_').pop();

        try {
            const sanctions = await db.all('SELECT sanction_id, sanction_type, reason FROM corregedoria_sanctions WHERE sanctioned_user_id = $1 ORDER BY applied_at DESC', [targetUserId]);

            if (sanctions.length === 0) {
                return await interaction.reply({ content: '✅ Este oficial não possui sanções para editar.', ephemeral: true });
            }

            const options = sanctions.map(s => ({
                label: `${s.sanction_type} (ID: ${s.sanction_id})`,
                description: s.reason.substring(0, 100),
                value: s.sanction_id.toString(),
            }));

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`edit_sanction_select`) // Handler único
                    .setPlaceholder('Selecione a sanção que deseja editar...')
                    .addOptions(options)
            );

            await interaction.reply({ content: 'Selecione a sanção para editar a justificativa.', components: [selectMenu], ephemeral: true });

        } catch (error) {
            console.error('Erro ao preparar edição de sanção:', error);
        }
    }
};