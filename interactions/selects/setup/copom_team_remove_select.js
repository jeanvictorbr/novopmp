const { getCopomTeamsMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'copom_team_remove_select',
  async execute(interaction) {
    const channelIdToRemove = interaction.values[0];
    const channelToRemove = await interaction.guild.channels.fetch(channelIdToRemove).catch(() => null);
    if (channelToRemove) {
        await channelToRemove.delete('Equipe removida pelo sistema Phoenix.');
    }
    await db.run('DELETE FROM patrol_teams WHERE channel_id = $1', [channelIdToRemove]);
    const payload = await getCopomTeamsMenuPayload(db);
    await interaction.update(payload);
  },
};