const db = require('../../../database/db.js');
const { getAcademyMenuPayload } = require('../../../views/setup_views.js');

module.exports = {
  customId: 'academy_logs_channel_select',
  async execute(interaction) {
    try {
      // Garante que a interação não falhe por tempo
      await interaction.deferUpdate();
      
      const selectedChannelId = interaction.values[0];
      
      // Salva a nova configuração no banco de dados
      await db.run(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        ['academy_logs_channel_id', selectedChannelId]
      );

      // Recarrega e mostra o painel da academia atualizado com a nova informação
      const updatedMenu = await getAcademyMenuPayload(db);
      await interaction.editReply(updatedMenu);

    } catch (error) {
      console.error("Erro ao definir o canal de logs da academia:", error);
      // Se algo der errado, informa o usuário de forma clara
      await interaction.editReply({ 
        content: '❌ Ocorreu um erro ao tentar salvar o canal de logs. Por favor, verifique o console e tente novamente.',
        embeds: [],
        components: []
      });
    }
  },
};