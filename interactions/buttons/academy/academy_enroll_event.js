const db = require('../../../database/db.js');

module.exports = {
    customId: (id) => id.startsWith('academy_enroll_event'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const [, eventId] = interaction.customId.split('|');
        const userId = interaction.user.id;
        
        try {
            const event = await db.get('SELECT course_id FROM academy_events WHERE event_id = $1', [eventId]);
            if (!event) return await interaction.editReply('❌ Esta aula agendada não foi encontrada ou pode ter sido cancelada.');

            const courseId = event.course_id;
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            if (!course) return await interaction.editReply('❌ O curso associado a esta aula não foi encontrado.');
            
            const isEnrolled = await db.get('SELECT * FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
            if (isEnrolled) return await interaction.editReply(`❌ Você já está inscrito(a) na lista de espera/turma para este curso.`);

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
                    await thread.members.add(userId, `Inscrito na turma: ${course.name}`);
                    await thread.send({ content: `👋 Bem-vindo(a) à turma, <@${userId}>!` });
                }
            }
            
            await interaction.editReply(`✅ Inscrição na turma do curso **${course.name}** realizada com sucesso! Você foi adicionado(a) à sala de discussão.`);

        } catch (error) {
            console.error("Erro ao se inscrever em evento:", error);
            await interaction.editReply('❌ Ocorreu um erro ao processar sua inscrição.');
        }
    },
};