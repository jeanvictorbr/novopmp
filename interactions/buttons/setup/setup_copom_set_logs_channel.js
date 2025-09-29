const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
module.exports = {
  customId: 'setup_copom_set_logs_channel',
  async execute(interaction) {
    const menu = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId('setup_copom_logs_channel_select').setPlaceholder('Selecione o canal de logs...').addChannelTypes(ChannelType.GuildText)
    );
    await interaction.update({ components: [menu] });
  },
};