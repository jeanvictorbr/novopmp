// Local: interactions/buttons/setup/enlistment_set_public_channel.js
const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');

module.exports = {
  customId: 'enlistment_set_public_channel',
  async execute(interaction) {
    const menu = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('enlistment_public_channel_select')
        .setPlaceholder('Selecione o canal para o painel público...')
        .addChannelTypes(ChannelType.GuildText)
    );
    await interaction.update({ content: 'Selecione o canal onde os novos membros poderão se alistar.', components: [menu] });
  },
};