const { getCopomMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'setup_copom_role_select',
  async execute(interaction) {
    await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['em_servico_role_id', interaction.values[0]]);
    const payload = await getCopomMenuPayload(db);
    await interaction.update(payload);
  },
};