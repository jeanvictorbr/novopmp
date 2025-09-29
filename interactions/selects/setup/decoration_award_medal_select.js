const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    customId: (customId) => customId.startsWith('decoration_award_medal_select_'),
    async execute(interaction) {
        const parts = interaction.customId.split('_');
        const targetUserId = parts.pop();
        const medalId = interaction.values[0];
        
        const modal = new ModalBuilder()
            .setCustomId(`decoration_award_modal_${targetUserId}_${medalId}`)
            .setTitle('Justificativa da Condecoração');
            
        const reasonInput = new TextInputBuilder()
            .setCustomId('award_reason')
            .setLabel("Motivo/Justificativa")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Descreva o ato de bravura ou o motivo pelo qual o oficial está recebendo esta honraria.")
            .setRequired(true);
            
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        
        await interaction.showModal(modal);
    }
};