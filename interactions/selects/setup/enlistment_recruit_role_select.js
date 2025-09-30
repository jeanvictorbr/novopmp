// Local: interactions/selects/setup/enlistment_recruit_role_select.js
const { getEnlistmentMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'enlistment_recruit_role_select',
  async execute(interaction) {
    await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['enlistment_recruit_role_id', interaction.values[0]]);
    const payload = await getEnlistmentMenuPayload(db);
    await interaction.update(payload);
  },
};