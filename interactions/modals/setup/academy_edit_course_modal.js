const { getAcademyMenuPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');
const { logAcademyAction } = require('../../../utils/academy/logUtils.js');

module.exports = {
  customId: 'academy_edit_course_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const courseId = interaction.fields.getTextInputValue('course_id_hidden');
      const newCourseName = interaction.fields.getTextInputValue('course_name');
      const newDescription = interaction.fields.getTextInputValue('course_description');
      const newRequiredHours = parseInt(interaction.fields.getTextInputValue('required_hours')) || 0;

      if (isNaN(newRequiredHours) || newRequiredHours < 0) {
        return await interaction.editReply('❌ O número de horas mínimas deve ser um número inteiro positivo.');
      }
      
      const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
      if (!course) {
        return await interaction.editReply('❌ Curso não encontrado no banco de dados.');
      }

      // Atualiza o nome do cargo, se tiver sido alterado
      if (course.name !== newCourseName) {
        const role = interaction.guild.roles.cache.get(course.role_id);
        if (role) {
          await role.setName(newCourseName, `Nome do curso "${course.name}" alterado.`).catch(console.error);
        }
      }

      // Atualiza o banco de dados
      await db.run(
        'UPDATE academy_courses SET name = $1, description = $2, required_hours = $3 WHERE course_id = $4',
        [newCourseName, newDescription, newRequiredHours, courseId]
      );

      await interaction.editReply(`✅ Curso **${newCourseName}** atualizado com sucesso!`);
      
      // Atualiza o painel da Academia
      const updatedMenu = await getAcademyMenuPayload(db);
      await interaction.message.edit(updatedMenu).catch(console.error);

    } catch (error) {
      console.error("Erro ao editar curso:", error);
      await interaction.editReply('❌ Ocorreu um erro ao editar o curso.');
    }
  },
};