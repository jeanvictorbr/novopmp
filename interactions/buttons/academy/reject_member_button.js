const db = require('../../../database/db.js');
const { getCourseEnrollmentDashboardPayload } = require('../../../views/setup_views.js');

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

            // Apenas remove o usuário da lista de inscrições
            await db.run('DELETE FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [userId, courseId]);

            // --- INÍCIO DA MODIFICAÇÃO ---
            // Adicionada a lógica para remover o membro do tópico de discussão
            if (course.thread_id) {
                const thread = await interaction.guild.channels.fetch(course.thread_id).catch(() => null);
                if (thread) {
                    await thread.members.remove(userId, 'Reprovado no curso.').catch(console.error);
                }
            }
            // --- FIM DA MODIFICAÇÃO ---

            // Atualiza o painel para remover o usuário da lista
            const updatedEnrollments = await db.all('SELECT * FROM academy_enrollments WHERE course_id = $1', [courseId]);
            const updatedDashboard = await getCourseEnrollmentDashboardPayload(db, interaction.guild, course, updatedEnrollments);
            await interaction.editReply(updatedDashboard);

            await interaction.followUp({ content: `✅ ${member.displayName} foi reprovado(a) e removido(a) da lista.`, ephemeral: true });

        } catch (error) {
            console.error("Erro ao reprovar oficial:", error);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao reprovar o oficial.', ephemeral: true });
        }
    },
};