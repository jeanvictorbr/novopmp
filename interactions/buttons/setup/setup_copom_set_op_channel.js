const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
module.exports = {
  customId: 'setup_copom_set_op_channel',
  async execute(interaction) {
    const menu = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId('setup_copom_op_channel_select').setPlaceholder('Selecione o canal de operações...').addChannelTypes(ChannelType.GuildText)
    );
    await interaction.update({ components: [menu] });
  },
};