const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('reject_member_'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const parts = interaction.customId.split('_');
        const courseId = parts[2];
        const userId = parts[3];
        
        try {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            const member = await interaction.guild.members.fetch(userId).catch(() => null);

            if (!course || !member) {
                return await interaction.editReply('❌ Curso ou oficial não encontrado. A recusa pode ter sido processada.');
            }

            await db.run('DELETE FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [member.id, courseId]);

            await interaction.editReply(`✅ <@${member.id}> foi recusado(a) do curso **${course.name}**. Ele foi removido da lista de espera.`);

        } catch (error) {
            console.error("Erro ao recusar oficial:", error);
            await interaction.editReply('❌ Ocorreu um erro ao recusar o oficial. Por favor, tente novamente.');
        }
    },
};