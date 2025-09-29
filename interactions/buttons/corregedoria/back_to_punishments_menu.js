const { getCorregedoriaPunishmentsMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'back_to_punishments_menu',
    async execute(interaction) {
        await interaction.deferUpdate();
        const payload = await getCorregedoriaPunishmentsMenuPayload(db);
        await interaction.editReply(payload);
    },
};