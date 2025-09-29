const { getMainMenuPayload } = require('../../../views/setup_views.js');

module.exports = {
  customId: 'back_to_main_menu',
  async execute(interaction) {
    const payload = await getMainMenuPayload();
    await interaction.update(payload);
  },
};