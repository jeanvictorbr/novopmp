const db = require('../../../database/db.js');
const { getAcademyMenuPayload } = require('../../../views/setup_views.js');

module.exports = {
  customId: 'academy_remove_course_select',
  async execute(interaction) {
    await interaction.deferUpdate();
    
    const courseId = interaction.values[0];
    
    try {
      // Busca o curso para pegar o ID do cargo
      const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
      
      // Deleta o curso do banco de dados
      await db.run('DELETE FROM academy_courses WHERE course_id = $1', [courseId]);
      
      // Se houver um cargo, ele o deleta
      if (course && course.role_id) {
        const role = interaction.guild.roles.cache.get(course.role_id);
        if (role) {
          await role.delete(`Curso "${course.name}" removido da Academia.`).catch(console.error);
        }
      }
      
      // Atualiza o painel de configuração da Academia
      const updatedMenu = await getAcademyMenuPayload(db);
      await interaction.editReply(updatedMenu);

    } catch (error) {
      console.error("Erro ao remover curso:", error);
      await interaction.editReply('❌ Ocorreu um erro ao remover o curso.');
    }
  },
};