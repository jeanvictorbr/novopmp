const { getEnrollmentDashboardPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'back_to_enrollment_dashboard',
  async execute(interaction) {
    await interaction.deferUpdate();

    try {
        const payload = await getEnrollmentDashboardPayload(db, interaction.guild);
        await interaction.editReply(payload);
    } catch (error) {
        console.error("Erro ao voltar para o dashboard de certificação:", error);
        await interaction.editReply('❌ Ocorreu um erro ao voltar para o dashboard.');
    }
  },
};