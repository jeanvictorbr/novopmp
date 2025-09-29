const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'corregedoria_remove_punishment',
    async execute(interaction) {
        await interaction.deferUpdate();
        try {
            const punishments = await db.all('SELECT name FROM corregedoria_punishments ORDER BY name ASC');

            if (punishments.length === 0) {
                // Esta verificação já existe no painel, mas é uma segurança adicional.
                return await interaction.followUp({ content: 'Não há punições para remover.', ephemeral: true });
            }

            const options = punishments.map(p => ({
                label: p.name,
                value: p.name,
            }));

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('corregedoria_punishment_remove_select')
                    .setPlaceholder('Selecione uma punição para remover...')
                    .addOptions(options)
            );
            
            const backButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_punishments_menu') // Botão para voltar ao menu anterior
                    .setLabel('Voltar')
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({
                content: 'Selecione no menu abaixo a punição que você deseja remover permanentemente.',
                embeds: [],
                components: [selectMenu, backButton]
            });
        } catch (error) {
            console.error("Erro ao preparar remoção de punição:", error);
        }
    }
};