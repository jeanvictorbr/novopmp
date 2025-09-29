const { EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');
const { generateDossieEmbed } = require('../../../commands/dossie.js');

module.exports = {
    customId: (customId) => customId.startsWith('remove_sanction_select_'),
    async execute(interaction) {
        await interaction.deferUpdate();
        
        const sanctionIdToRemove = interaction.values[0];
        const targetUserId = interaction.customId.split('_').pop();
        const targetUser = await interaction.client.users.fetch(targetUserId);

        try {
            // Verifica se a punição está ativa para remover o cargo
            const activePunishment = await db.get('SELECT role_id FROM active_punishments WHERE sanction_id = $1', [sanctionIdToRemove]);
            if (activePunishment && activePunishment.role_id) {
                const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
                const role = await interaction.guild.roles.fetch(activePunishment.role_id).catch(() => null);
                if (member && role) {
                    await member.roles.remove(role, `Sanção ID ${sanctionIdToRemove} removida por ${interaction.user.tag}`);
                }
                await db.run('DELETE FROM active_punishments WHERE sanction_id = $1', [sanctionIdToRemove]);
            }

            // Remove a sanção do histórico principal
            await db.run('DELETE FROM corregedoria_sanctions WHERE sanction_id = $1', [sanctionIdToRemove]);

            // Atualiza a embed do dossiê para refletir a remoção
            const updatedDossie = await generateDossieEmbed(targetUser, interaction.guild);

            await interaction.editReply({
                content: `✅ Sanção (ID: ${sanctionIdToRemove}) removida com sucesso do histórico de **${targetUser.username}**.`,
                embeds: [updatedDossie],
                components: interaction.message.components // Mantém os botões de gerenciamento
            });

        } catch (error) {
            console.error('Erro ao remover sanção:', error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao processar a remoção da sanção.', components: [] });
        }
    }
};