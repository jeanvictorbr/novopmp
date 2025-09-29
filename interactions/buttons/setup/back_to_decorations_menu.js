const { getDecorationsMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'back_to_decorations_menu',
  async execute(interaction) {
    await interaction.deferUpdate();
    const payload = await getDecorationsMenuPayload(db);
    await interaction.editReply(payload);
  },
};