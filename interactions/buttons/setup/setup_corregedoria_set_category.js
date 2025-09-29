const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../database/db.js');
const { getCorregedoriaMenuPayload } = require('../../../views/setup_views.js');

module.exports = {
  customId: 'setup_corregedoria_set_category',
  async execute(interaction) {
    const menu = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('corregedoria_category_select_unique').setPlaceholder('Selecione a categoria...').addChannelTypes(ChannelType.GuildCategory));
    const backButton = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_to_corregedoria_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary));
    
    const response = await interaction.update({ content: 'Selecione a categoria onde os canais de denúncia (tickets) serão criados.', components: [menu, backButton], embeds: [], fetchReply: true });

    const collector = response.createMessageComponentCollector({ componentType: ComponentType.ChannelSelect, filter: i => i.user.id === interaction.user.id, time: 60000, max: 1 });

    collector.on('collect', async i => {
      await i.deferUpdate();
      await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['corregedoria_tickets_category_id', i.values[0]]);
      const payload = await getCorregedoriaMenuPayload(db);
      await i.editReply(payload);
    });
  },
};