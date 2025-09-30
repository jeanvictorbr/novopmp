const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_request_course_select',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const courseId = interaction.values[0];
    const userId = interaction.user.id;
    
    try {
      const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
      if (!course) return await interaction.editReply('❌ Curso não encontrado.');
      
      const isEnrolled = await db.get('SELECT * FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
      if (isEnrolled) return await interaction.editReply(`❌ Você já está na lista de espera para este curso.`);

      const isCertified = await db.get('SELECT * FROM user_certifications WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
      if (isCertified) return await interaction.editReply(`❌ Você já possui a certificação para: **${course.name}**.`);

      const history = await db.get('SELECT SUM(duration_seconds) AS total_seconds FROM patrol_history WHERE user_id = $1', [userId]);
      const totalHistorySeconds = history?.total_seconds || 0;
      
      const activeSession = await db.get('SELECT start_time FROM patrol_sessions WHERE user_id = $1', [userId]);
      const activeSeconds = activeSession ? Math.floor(Date.now() / 1000) - activeSession.start_time : 0;
      
      const totalSeconds = totalHistorySeconds + activeSeconds;
      const totalHours = Math.floor(totalSeconds / 3600);
      
      if (totalHours < course.required_hours) {
        return await interaction.editReply(`❌ Você não tem horas de patrulha suficientes (${totalHours}h). Requisito: **${course.required_hours}h**.`);
      }

      await db.run('INSERT INTO academy_enrollments (user_id, course_id, enrollment_date) VALUES ($1, $2, $3)', [userId, courseId, Math.floor(Date.now() / 1000)]);
      
      if (course.thread_id) {
          const thread = await interaction.guild.channels.fetch(course.thread_id).catch(() => null);
          if (thread) {
              await thread.members.add(userId, `Solicitou inscrição no curso: ${course.name}`);
              await thread.send({ content: `👋 <@${userId}>, você demonstrou interesse no curso **${course.name}** e foi adicionado à discussão.` });
          }
      }
      
      await interaction.editReply(`✅ Você entrou na lista de espera para o curso **${course.name}** com sucesso!`);

    } catch (error) {
      console.error("Erro ao solicitar curso:", error);
      await interaction.editReply('❌ Ocorreu um erro ao processar sua solicitação.');
    }
  },
};