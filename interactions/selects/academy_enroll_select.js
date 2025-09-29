const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js');

module.exports = {
  customId: 'academy_enroll_select',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const courseId = interaction.values[0];
    const userId = interaction.user.id;
    
    try {
      const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
      if (!course) {
        return await interaction.editReply('❌ Curso não encontrado.');
      }
      
      const isEnrolled = await db.get('SELECT * FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
      if (isEnrolled) {
        return await interaction.editReply(`❌ Você já está inscrito(a) neste curso e aguarda aprovação.`);
      }

      const isCertified = await db.get('SELECT * FROM user_certifications WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
      if (isCertified) {
        return await interaction.editReply(`❌ Você já está certificado(a) neste curso: **${course.name}**.`);
      }

      const history = await db.all('SELECT SUM(duration_seconds) AS total_seconds FROM patrol_history WHERE user_id = $1', [userId]);
      const totalHistorySeconds = history[0]?.total_seconds || 0;
      
      const activeSession = await db.get('SELECT start_time FROM patrol_sessions WHERE user_id = $1', [userId]);
      const activeSeconds = activeSession ? Math.floor(Date.now() / 1000) - activeSession.start_time : 0;
      
      const totalSeconds = totalHistorySeconds + activeSeconds;
      const totalHours = Math.floor(totalSeconds / 3600);
      
      if (totalHours < course.required_hours) {
        return await interaction.editReply(`❌ Você não tem horas de patrulha suficientes para se inscrever no curso **${course.name}**. Requisito: **${course.required_hours}h**.`);
      }

      await db.run('INSERT INTO academy_enrollments (user_id, course_id, enrollment_date) VALUES ($1, $2, $3)', [userId, courseId, Math.floor(Date.now() / 1000)]);
      
      const thread = interaction.guild.channels.cache.get(course.thread_id);
      if (thread) {
          // Adiciona o membro à thread e envia a mensagem de boas-vindas
          await thread.members.add(userId, `Inscrito no curso: ${course.name}`);
          await thread.send({
              content: `<@${userId}>, bem-vindo(a) ao curso **${course.name}**! Use este tópico para interagir com seus instrutores e tirar dúvidas.`
          });
      }
      
      await interaction.editReply(`✅ Inscrição no curso **${course.name}** realizada com sucesso! Você foi adicionado(a) à discussão do curso.`);

    } catch (error) {
      console.error("Erro ao se inscrever no curso:", error);
      await interaction.editReply('❌ Ocorreu um erro ao processar sua inscrição.');
    }
  },
};