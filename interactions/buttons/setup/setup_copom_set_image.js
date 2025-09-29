const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customId: 'setup_copom_set_image',
  async execute(interaction) {
    const modal = new ModalBuilder().setCustomId('copom_set_image_modal').setTitle('Imagem do Painel COPOM');
    const urlInput = new TextInputBuilder().setCustomId('image_url').setLabel('URL da Imagem').setPlaceholder('https://i.imgur.com/seu-link.png').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
    await interaction.showModal(modal);
  },
};