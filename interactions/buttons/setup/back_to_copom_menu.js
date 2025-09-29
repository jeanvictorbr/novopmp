const { getCopomMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'back_to_copom_menu',
  async execute(interaction) {
    const payload = await getCopomMenuPayload(db);
    await interaction.update(payload);
  },
};