const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('dossie_manage_promotions_'),
    async execute(interaction) {
        await interaction.deferUpdate();
        const targetUserId = interaction.customId.split('_').pop();

        try {
            const promotions = await db.all('SELECT id, role_id, promoted_at FROM rank_history WHERE user_id = $1 ORDER BY promoted_at DESC', [targetUserId]);

            if (promotions.length === 0) {
                return interaction.editReply({ content: '✅ Este oficial não possui promoções no histórico para remover.', components: [] });
            }

            const options = await Promise.all(promotions.map(async (p) => {
                const role = await interaction.guild.roles.fetch(p.role_id).catch(() => null);
                const roleName = role ? role.name : 'Cargo Apagado';
                const date = new Date(p.promoted_at * 1000).toLocaleDateString('pt-BR');
                return {
                    label: `Promovido a ${roleName}`,
                    description: `Em: ${date} (ID do Histórico: ${p.id})`,
                    value: p.id.toString(), // O valor é o ID único do registro no banco
                };
            }));

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`dossie_remove_promotion_select_${targetUserId}`)
                    .setPlaceholder('Selecione a promoção para REMOVER do histórico...')
                    .addOptions(options)
            );

            await interaction.editReply({ content: 'Selecione no menu abaixo a promoção que você deseja apagar permanentemente do histórico do oficial.', components: [selectMenu] });

        } catch (error) {
            console.error('Erro ao preparar remoção de promoção via dossiê:', error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao buscar o histórico de promoções.', components: [] });
        }
    }
};