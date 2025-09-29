const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { getCourseEnrollmentDashboardPayload } = require('../../views/setup_views.js');

module.exports = {
    customId: 'certify_course_select',
    async execute(interaction) {
        await interaction.deferUpdate();

        const courseId = interaction.values[0];

        try {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            const enrollments = await db.all('SELECT * FROM academy_enrollments WHERE course_id = $1', [courseId]);
            
            // Verifica se o curso existe ou se há inscritos
            if (!course) {
                return await interaction.editReply({ content: '❌ Curso não encontrado.', components: [] });
            }

            // Usa a nova função para gerar o dashboard com os inscritos
            const payload = await getCourseEnrollmentDashboardPayload(course, interaction.guild, enrollments);
            await interaction.editReply(payload);

        } catch (error) {
            console.error("Erro ao selecionar o curso para certificação:", error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao buscar os membros. Por favor, tente novamente.', embeds: [], components: [] });
        }
    },
};