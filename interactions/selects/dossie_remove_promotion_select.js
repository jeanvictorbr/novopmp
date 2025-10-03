const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { generateDossieEmbed } = require('../../commands/dossie.js');

module.exports = {
    customId: (customId) => customId.startsWith('dossie_remove_promotion_select_'),
    async execute(interaction) {
        await interaction.deferUpdate();
        
        const historyIdToRemove = interaction.values[0];
        const targetUserId = interaction.customId.split('_').pop();
        const targetUser = await interaction.client.users.fetch(targetUserId);

        try {
            // Remove a promoção do histórico principal
            await db.run('DELETE FROM rank_history WHERE id = $1', [historyIdToRemove]);

            // Atualiza a embed do dossiê para refletir a remoção
            const updatedDossie = await generateDossieEmbed(targetUser, interaction.guild);

            await interaction.editReply({
                content: `✅ Promoção (ID do Histórico: ${historyIdToRemove}) removida com sucesso do dossiê de **${targetUser.username}**.`,
                embeds: [updatedDossie],
                components: interaction.message.components // Mantém os botões de gerenciamento
            });

        } catch (error) {
            console.error('Erro ao remover promoção:', error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao processar a remoção da promoção.', components: [] });
        }
    }
};