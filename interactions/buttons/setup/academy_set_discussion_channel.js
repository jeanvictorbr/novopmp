const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAcademyMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_set_discussion_channel',
  async execute(interaction) {
    await interaction.deferUpdate();

    const embed = new EmbedBuilder()
      .setColor('Yellow')
      .setTitle('Definir Canal de Discussões')
      .setDescription('Selecione o canal de texto onde os tópicos de discussão dos cursos serão criados.')
      .setFooter({ text: 'O bot precisa de permissão para criar tópicos neste canal.' });

    const selectMenu = new ChannelSelectMenuBuilder()
      .setCustomId('academy_discussion_channel_select')
      .setPlaceholder('Selecione um canal...')
      .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const backButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('back_to_academy_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row, backButton] });
  },
};