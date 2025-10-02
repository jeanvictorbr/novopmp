const { getAchievementsMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'career_manage_achievements',
  async execute(interaction) {
    const payload = await getAchievementsMenuPayload(db);
    await interaction.update(payload);
  },
};