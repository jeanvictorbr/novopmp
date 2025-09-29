const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customId: 'decorations_set_promote_image',
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('decorations_set_promote_image_modal')
      .setTitle('Imagem de Anúncio de Promoção');

    const imageUrlInput = new TextInputBuilder()
      .setCustomId('promote_image_url')
      .setLabel("URL da Imagem de Banner")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Cole a URL da imagem (ex: https://i.imgur.com/imagem.png)")
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(imageUrlInput));
    await interaction.showModal(modal);
  },
};