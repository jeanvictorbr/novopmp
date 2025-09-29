const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../database/db.js');
const { getCorregedoriaMenuPayload } = require('../../../views/setup_views.js');

module.exports = {
  customId: 'setup_corregedoria_set_transcript',
  async execute(interaction) {
    try {
      const menu = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('corregedoria_transcript_select_unique')
          .setPlaceholder('Selecione o canal para os transcripts...')
          .addChannelTypes(ChannelType.GuildText)
      );
      const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('back_to_corregedoria_menu')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
      );
      
      const response = await interaction.update({
        content: 'Selecione o canal privado onde os arquivos de texto (transcripts) das denúncias finalizadas serão salvos.',
        embeds: [],
        components: [menu, backButton],
        fetchReply: true
      });

      // Cria um "ouvinte" que espera pela sua seleção
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === interaction.user.id,
        time: 60000, // 1 minuto de tempo para escolher
        max: 1
      });

      collector.on('collect', async i => {
        await i.deferUpdate();
        const selectedChannelId = i.values[0];

        // Salva a escolha no banco de dados
        await db.run(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
          ['corregedoria_transcript_channel_id', selectedChannelId]
        );

        // Recarrega o painel da corregedoria com a informação atualizada
        const payload = await getCorregedoriaMenuPayload(db);
        await i.editReply(payload);
      });

      collector.on('end', async (collected) => {
        if (collected.size === 0) {
          const payload = await getCorregedoriaMenuPayload(db);
          await interaction.editReply({ content: 'Tempo esgotado. Ação cancelada.', ...payload });
        }
      });

    } catch (error) {
      console.error("Erro ao configurar canal de transcripts:", error);
      await interaction.editReply({ content: '❌ Ocorreu um erro crítico. Verifique o console.', components: [], embeds: [] });
    }
  },
};