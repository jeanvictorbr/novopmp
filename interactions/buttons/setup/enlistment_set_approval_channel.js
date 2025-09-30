// Local: interactions/buttons/setup/enlistment_set_approval_channel.js
const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');

module.exports = {
  customId: 'enlistment_set_approval_channel',
  async execute(interaction) {
    const menu = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('enlistment_approval_channel_select')
        .setPlaceholder('Selecione o canal para aprovações...')
        .addChannelTypes(ChannelType.GuildText)
    );
    await interaction.update({ content: 'Selecione o canal onde as fichas de alistamento serão enviadas para análise.', components: [menu] });
  },
};