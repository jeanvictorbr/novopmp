const { getCourseEnrollmentDashboardPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_certify_course_select',
  async execute(interaction) {
    await interaction.deferUpdate();
    const courseId = interaction.values[0];

    try {
      const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
      const enrollments = await db.all('SELECT * FROM academy_enrollments WHERE course_id = $1', [courseId]);

      if (!course) {
        return await interaction.editReply({ 
          content: '❌ O curso selecionado não foi encontrado.', 
          components: []
        });
      }

      // --- CORREÇÃO APLICADA AQUI ---
      // A ordem dos argumentos agora está correta, passando 'db' primeiro.
      const payload = await getCourseEnrollmentDashboardPayload(db, interaction.guild, course, enrollments);
      await interaction.editReply(payload);

    } catch (error) {
      console.error("Erro ao carregar lista de inscritos:", error);
      await interaction.editReply('❌ Ocorreu um erro ao carregar a lista de inscritos. Por favor, tente novamente mais tarde.');
    }
  },
};