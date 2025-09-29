const { getCorregedoriaMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');
module.exports = {
  customId: 'corregedoria_transcript_channel_select',
  async execute(interaction) {
    await interaction.deferUpdate();
    await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['corregedoria_transcript_channel_id', interaction.values[0]]);
    const payload = await getCorregedoriaMenuPayload(db);
    await interaction.editReply(payload);
  },
};