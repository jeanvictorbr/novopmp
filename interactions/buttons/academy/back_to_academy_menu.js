const { getAcademyMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'back_to_academy_menu',
  async execute(interaction) {
    await interaction.deferUpdate();
    
    try {
      const payload = await getAcademyMenuPayload(db);
      await interaction.editReply(payload);
    } catch (error) {
      console.error("Erro ao voltar para o menu da Academia:", error);
      await interaction.editReply({ content: '❌ Ocorreu um erro ao carregar o menu da Academia. Por favor, tente novamente.', components: [] });
    }
  },
};