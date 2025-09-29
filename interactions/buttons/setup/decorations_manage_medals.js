const { getDecorationsManageMedalsPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'decorations_manage_medals',
  async execute(interaction) {
    await interaction.deferUpdate();
    const payload = await getDecorationsManageMedalsPayload(db);
    await interaction.editReply(payload);
  },
};