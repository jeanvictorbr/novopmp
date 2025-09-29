const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customId: 'decorations_add_medal',
  async execute(interaction) {
    const modal = new ModalBuilder().setCustomId('decorations_add_medal_modal').setTitle('Criar Nova Medalha');
    const nameInput = new TextInputBuilder().setCustomId('medal_name').setLabel("Nome da Medalha").setStyle(TextInputStyle.Short).setRequired(true);
    const descriptionInput = new TextInputBuilder().setCustomId('medal_description').setLabel("Descrição (O que ela representa?)").setStyle(TextInputStyle.Paragraph).setRequired(true);
    const emojiInput = new TextInputBuilder().setCustomId('medal_emoji').setLabel("Emoji (Opcional)").setStyle(TextInputStyle.Short).setRequired(false);
    modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(descriptionInput), new ActionRowBuilder().addComponents(emojiInput));
    await interaction.showModal(modal);
  },
};