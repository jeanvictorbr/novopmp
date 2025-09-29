const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    customId: 'corregedoria_add_punishment',
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('corregedoria_punishment_add_modal')
            .setTitle('Adicionar Nova Punição');

        const nameInput = new TextInputBuilder()
            .setCustomId('punishment_name')
            .setLabel("Nome da Punição (Ex: Advertência Nível 1)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('punishment_description')
            .setLabel("Descrição (O que esta punição acarreta?)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const durationInput = new TextInputBuilder()
            .setCustomId('punishment_duration')
            .setLabel("Duração (Ex: 7d, 24h, 30m) - Opcional")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Deixe em branco para uma punição permanente.")
            .setRequired(false);
            
        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(descriptionInput),
            new ActionRowBuilder().addComponents(durationInput)
        );

        await interaction.showModal(modal);
    }
};