const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');

module.exports = {
  customId: 'academy_set_channel',
  async execute(interaction) {
    await interaction.deferUpdate();
    
    const channelMenu = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('academy_channel_select')
        .setPlaceholder('Selecione o canal de estudos da Academia...')
        .addChannelTypes(ChannelType.GuildText)
    );
    
    await interaction.editReply({ 
      content: 'Escolha o canal onde o painel da Academia será postado:',
      components: [channelMenu]
    });
  },
};