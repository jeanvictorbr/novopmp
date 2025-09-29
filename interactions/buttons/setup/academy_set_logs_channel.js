const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, ComponentType } = require('discord.js');
const db = require('../../../database/db.js');
const { getAcademyMenuPayload } = require('../../../views/setup_views.js');

module.exports = {
  customId: 'academy_set_logs_channel',
  async execute(interaction) {
    try {
      const menu = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('academy_logs_channel_select_unique') // ID único para o menu
          .setPlaceholder('Selecione o canal para os logs da academia...')
          .addChannelTypes(ChannelType.GuildText)
      );

      // Mostra o menu de seleção
      const response = await interaction.update({
        content: 'Por favor, selecione o canal de logs no menu abaixo. A seleção expira em 1 minuto.',
        components: [menu],
        embeds: [],
        fetchReply: true // Importante para poder criar o coletor
      });

      // Cria um "ouvinte" que espera apenas pela sua seleção
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000, // 1 minuto de tempo para escolher
        max: 1 // Para o coletor após 1 seleção
      });

      collector.on('collect', async (i) => {
        await i.deferUpdate();
        const selectedChannelId = i.values[0];

        // Salva a escolha no banco de dados
        await db.run(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
          ['academy_logs_channel_id', selectedChannelId]
        );

        // Recarrega o painel da academia com a informação atualizada
        const updatedMenuPayload = await getAcademyMenuPayload(db);
        await i.editReply(updatedMenuPayload);
      });

      collector.on('end', async (collected) => {
        // Se o tempo acabar e nada for selecionado, volta ao menu anterior
        if (collected.size === 0) {
          const originalMenuPayload = await getAcademyMenuPayload(db);
          await interaction.editReply({ content: 'Tempo esgotado. Voltando ao menu da academia.', ...originalMenuPayload });
        }
      });

    } catch (error) {
      console.error("Erro ao configurar canal de logs da academia:", error);
      await interaction.editReply({ content: '❌ Ocorreu um erro crítico. Verifique o console.', components: [], embeds: [] });
    }
  },
};