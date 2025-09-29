const db = require('../../../database/db.js');
const { getAcademyMenuPayload } = require('../../../views/setup_views.js');

module.exports = {
  customId: 'academy_channel_select',
  async execute(interaction) {
    await interaction.deferUpdate();
    
    const selectedChannelId = interaction.values[0];
    
    try {
      await db.run(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        ['academy_channel_id', selectedChannelId]
      );

      const updatedMenu = await getAcademyMenuPayload(db);
      await interaction.editReply(updatedMenu);

    } catch (error) {
      console.error("Erro ao definir canal da Academia:", error);
      await interaction.editReply('❌ Ocorreu um erro ao salvar o canal da Academia.');
    }
  },
};