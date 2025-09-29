const db = require('../../../database/db.js');
const { getAcademyMenuPayload } = require('../../../views/setup_views.js');
const { logAcademyAction } = require('../../../utils/academy/logUtils.js');

module.exports = {
  customId: 'academy_remove_course_modal',
  async execute(interaction) {
    await interaction.deferUpdate();

    const courseId = interaction.fields.getTextInputValue('course_id').toUpperCase();

    try {
      const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
      if (!course) {
        return await interaction.editReply({ content: '❌ ID do curso não encontrado.', ephemeral: true });
      }

      if (course.thread_id) {
        const thread = await interaction.guild.channels.fetch(course.thread_id).catch(() => null);
        if (thread) {
          await thread.delete(`Curso removido: ${course.name}`);
        }
      }

      await db.run('DELETE FROM academy_enrollments WHERE course_id = $1', [courseId]);
      await db.run('DELETE FROM user_certifications WHERE course_id = $1', [courseId]);

      await db.run('DELETE FROM academy_courses WHERE course_id = $1', [courseId]);

      await interaction.editReply({ content: `✅ Curso **${course.name}** e suas discussões, inscrições e certificações foram removidos com sucesso!`, ephemeral: true });
      
      // LINHA QUE CAUSAVA O ERRO REMOVIDA
      // const payload = await getAcademyMenuPayload(db);
      // await interaction.message.edit(payload).catch(console.error);

    } catch (error) {
      console.error('Erro ao remover o curso:', error);
      await interaction.editReply({ content: '❌ Ocorreu um erro ao tentar remover o curso.', ephemeral: true });
    }
  },
};