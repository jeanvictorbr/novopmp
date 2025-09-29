const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
module.exports = {
  customId: 'setup_copom_set_teams_category',
  async execute(interaction) {
    const menu = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId('setup_copom_teams_category_select').setPlaceholder('Selecione a categoria para as equipes...').addChannelTypes(ChannelType.GuildCategory)
    );
    await interaction.update({ components: [menu] });
  },
};