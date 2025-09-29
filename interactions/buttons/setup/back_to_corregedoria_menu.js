const { getCorregedoriaMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'back_to_corregedoria_menu',
  async execute(interaction) {
    const payload = await getCorregedoriaMenuPayload(db);
    await interaction.update(payload);
  },
};