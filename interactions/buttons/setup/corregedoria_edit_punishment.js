const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'corregedoria_edit_punishment',
    async execute(interaction) {
        await interaction.deferUpdate();
        try {
            // CORREÇÃO: Seleciona apenas o 'name', que é o identificador.
            const punishments = await db.all('SELECT name FROM corregedoria_punishments ORDER BY name ASC');

            if (punishments.length === 0) {
                return await interaction.followUp({ content: 'Não há punições para editar.', ephemeral: true });
            }

            const options = punishments.map(p => ({
                label: p.name,
                value: p.name, // CORREÇÃO: Usa o nome como valor
            }));

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('corregedoria_punishment_edit_select')
                    .setPlaceholder('Selecione uma punição para editar...')
                    .addOptions(options)
            );
            
            const backButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_punishments_menu')
                    .setLabel('Voltar')
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({
                content: 'Selecione no menu abaixo a punição que você deseja editar.',
                embeds: [],
                components: [selectMenu, backButton]
            });
        } catch (error) {
            console.error("Erro ao preparar edição de punição:", error);
        }
    }
};