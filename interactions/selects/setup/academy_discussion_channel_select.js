const { getAcademyMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_discussion_channel_select',
  async execute(interaction) {
    await interaction.deferUpdate();

    const channelId = interaction.values[0];

    try {
      await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value', ['academy_discussion_channel_id', channelId]);
      
      const payload = await getAcademyMenuPayload(db);
      await interaction.editReply({ ...payload, content: '✅ Canal de discussões definido com sucesso!' });

    } catch (error) {
      console.error("Erro ao definir o canal de discussões:", error);
      await interaction.editReply({ content: '❌ Ocorreu um erro ao definir o canal.', ephemeral: true });
    }
  },
};