const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customId: 'setup_copom_set_footer',
  async execute(interaction) {
    const modal = new ModalBuilder().setCustomId('copom_set_footer_modal').setTitle('Rodapé do Módulo COPOM');
    const textInput = new TextInputBuilder().setCustomId('footer_text').setLabel('Texto do Rodapé').setPlaceholder('Police Flow - By Zépiqueno').setStyle(TextInputStyle.Short).setRequired(true);
    const iconInput = new TextInputBuilder().setCustomId('footer_icon_url').setLabel('URL do Ícone do Rodapé (Opcional)').setStyle(TextInputStyle.Short).setRequired(false);
    modal.addComponents(new ActionRowBuilder().addComponents(textInput), new ActionRowBuilder().addComponents(iconInput));
    await interaction.showModal(modal);
  },
};