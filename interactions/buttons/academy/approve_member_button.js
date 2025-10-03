const db = require('../../../database/db.js');
const { getCourseEnrollmentDashboardPayload } = require('../../../views/setup_views.js');
const { EmbedBuilder } = require('discord.js');

// (Copie e cole a função sendCertificationNotification completa que está no arquivo academy_certify_all.js aqui)

module.exports = {
    customId: (customId) => customId.startsWith('academy_approve_'),
    async execute(interaction) {
        await interaction.deferUpdate();
        const [, , courseId, userId] = interaction.customId.split('_');

        try {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            const member = await interaction.guild.members.fetch(userId).catch(() => null);

            if (!course || !member) {
                return await interaction.followUp({ content: '❌ Curso ou oficial não encontrado.', ephemeral: true });
            }

            // Lógica de certificação para um único membro
            await db.run('DELETE FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
            await db.run('INSERT INTO user_certifications (user_id, course_id, completion_date, certified_by) VALUES ($1, $2, $3, $4)', [userId, courseId, Math.floor(Date.now() / 1000), interaction.user.id]);
            
            const role = interaction.guild.roles.cache.get(course.role_id);
            if (role) await member.roles.add(role, `Certificado no curso: ${course.name}`);

            await sendCertificationNotification(interaction, member, course);

            // Atualiza o painel para remover o usuário da lista
            const updatedEnrollments = await db.all('SELECT * FROM academy_enrollments WHERE course_id = $1', [courseId]);
            const updatedDashboard = await getCourseEnrollmentDashboardPayload(db, interaction.guild, course, updatedEnrollments);
            await interaction.editReply(updatedDashboard);
            
            await interaction.followUp({ content: `✅ ${member.displayName} foi aprovado(a) com sucesso!`, ephemeral: true });

        } catch (error) {
            console.error("Erro ao aprovar oficial:", error);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao aprovar o oficial.', ephemeral: true });
        }
    },
};