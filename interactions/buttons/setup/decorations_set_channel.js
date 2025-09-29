const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType } = require('discord.js');
module.exports = {
  customId: 'decorations_set_channel',
  async execute(interaction) {
    const menu = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId('decorations_channel_select').setPlaceholder('Selecione o canal de anúncios...').addChannelTypes(ChannelType.GuildText)
    );
    await interaction.reply({ content: 'Selecione o canal onde os anúncios de promoções e condecorações serão publicados.', components: [menu], ephemeral: true });
  },
};