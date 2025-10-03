const db = require('../../../database/db.js');
const { getCourseEnrollmentDashboardPayload } = require('../../../views/setup_views.js');
const { updateAcademyPanel } = require('../../../utils/updateAcademyPanel.js'); // Importar o atualizador do painel

module.exports = {
    customId: (customId) => customId.startsWith('academy_reject_'),
    async execute(interaction) {
        await interaction.deferUpdate();
        const [, , courseId, userId] = interaction.customId.split('_');
        
        try {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            const member = await interaction.guild.members.fetch(userId).catch(() => null);

            if (!course || !member) {
                return await interaction.followUp({ content: '❌ Curso ou oficial não encontrado.', ephemeral: true });
            }

            await db.run('DELETE FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [userId, courseId]);

            if (course.thread_id) {
                const thread = await interaction.guild.channels.fetch(course.thread_id).catch(() => null);
                if (thread) {
                    await thread.members.remove(userId, 'Reprovado no curso.').catch(console.error);
                }
            }
            
            // --- INÍCIO DA MODIFICAÇÃO ---
            // Verifica se este foi o último aluno
            const remainingEnrollments = await db.get('SELECT COUNT(*) AS count FROM academy_enrollments WHERE course_id = $1', [courseId]);
            if (remainingEnrollments.count === 0) {
                await db.run("UPDATE academy_events SET status = 'finalizada' WHERE course_id = $1 AND status != 'finalizada'", [courseId]);
                await interaction.followUp({ content: 'ℹ️ Este era o último aluno da turma. A aula agendada foi removida da vitrine.', ephemeral: true });
            }
            // --- FIM DA MODIFICAÇÃO ---

            const updatedEnrollmentsAfter = await db.all('SELECT * FROM academy_enrollments WHERE course_id = $1', [courseId]);
            const updatedDashboard = await getCourseEnrollmentDashboardPayload(db, interaction.guild, course, updatedEnrollmentsAfter);
            await interaction.editReply(updatedDashboard);

            await interaction.followUp({ content: `✅ ${member.displayName} foi reprovado(a) e removido(a) da lista.`, ephemeral: true });

            await updateAcademyPanel(interaction.client); // Força a atualização final do painel público

        } catch (error) {
            console.error("Erro ao reprovar oficial:", error);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao reprovar o oficial.', ephemeral: true });
        }
    },
};