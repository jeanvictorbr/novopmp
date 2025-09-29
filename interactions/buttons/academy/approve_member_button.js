const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('approve_member_'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const parts = interaction.customId.split('_');
        const courseId = parts[2];
        const userId = parts[3];
        
        try {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            const member = await interaction.guild.members.fetch(userId).catch(() => null);

            if (!course || !member) {
                return await interaction.editReply('❌ Curso ou oficial não encontrado. A certificação pode ter sido processada.');
            }

            await db.run('DELETE FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [member.id, courseId]);
            await db.run('INSERT INTO user_certifications (user_id, course_id, completion_date) VALUES ($1, $2, $3)', [member.id, courseId, Math.floor(Date.now() / 1000)]);
            
            const role = interaction.guild.roles.cache.get(course.role_id);
            if (role) {
                await member.roles.add(role, `Aprovado no curso: ${course.name}`);
            }

            await interaction.editReply(`✅ <@${member.id}> foi aprovado(a) e certificado(a) com sucesso no curso **${course.name}**!`);
            
        } catch (error) {
            console.error("Erro ao aprovar oficial:", error);
            await interaction.editReply('❌ Ocorreu um erro ao aprovar o oficial. Por favor, tente novamente.');
        }
    },
};