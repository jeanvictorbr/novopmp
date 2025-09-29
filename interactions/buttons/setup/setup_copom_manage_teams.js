const { getCopomTeamsMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'setup_copom_manage_teams',
  async execute(interaction) {
    const payload = await getCopomTeamsMenuPayload(db);
    await interaction.update(payload);
  },
};