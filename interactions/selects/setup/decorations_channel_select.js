const db = require('../../../database/db.js');
const { getDecorationsMenuPayload } = require('../../../views/setup_views.js');
module.exports = {
  customId: 'decorations_channel_select',
  async execute(interaction) {
    await interaction.deferUpdate();
    await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['decorations_channel_id', interaction.values[0]]);
    const payload = await getDecorationsMenuPayload(db);
    await interaction.editReply(payload);
  },
};