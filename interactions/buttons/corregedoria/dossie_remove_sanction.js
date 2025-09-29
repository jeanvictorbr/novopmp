const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('dossie_remove_sanction_'),
    async execute(interaction) {
        await interaction.deferUpdate();
        const targetUserId = interaction.customId.split('_').pop();

        try {
            const sanctions = await db.all('SELECT sanction_id, sanction_type, reason FROM corregedoria_sanctions WHERE sanctioned_user_id = $1 ORDER BY applied_at DESC', [targetUserId]);

            if (sanctions.length === 0) {
                return interaction.editReply({ content: '✅ Este oficial não possui sanções para remover.', components: [] });
            }

            const options = sanctions.map(s => ({
                label: `${s.sanction_type} (ID: ${s.sanction_id})`,
                description: s.reason.substring(0, 100),
                value: s.sanction_id.toString(),
            }));

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`remove_sanction_select_${targetUserId}`)
                    .setPlaceholder('Selecione a sanção a ser REMOVIDA PERMANENTEMENTE...')
                    .addOptions(options)
            );

            await interaction.editReply({ content: 'Selecione no menu abaixo a sanção que você deseja apagar do histórico do oficial.', components: [selectMenu] });

        } catch (error) {
            console.error('Erro ao preparar remoção de sanção via dossiê:', error);
        }
    }
};