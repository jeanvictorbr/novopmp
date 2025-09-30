const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_schedule_course',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const coursesWithEnrollments = await db.all(`
            SELECT DISTINCT c.course_id, c.name, COUNT(e.user_id) as enrollment_count
            FROM academy_courses c
            JOIN academy_enrollments e ON c.course_id = e.course_id
            GROUP BY c.course_id, c.name
            HAVING COUNT(e.user_id) > 0
            ORDER BY c.name ASC
        `);

        if (coursesWithEnrollments.length === 0) {
            return await interaction.editReply('Não há cursos com oficiais na lista de espera para agendar.');
        }

        const options = coursesWithEnrollments.map(course => ({
            label: course.name,
            description: `${course.enrollment_count} oficial(is) na lista de espera.`,
            value: course.course_id,
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('academy_schedule_select_course')
            .setPlaceholder('Selecione um curso para agendar uma aula...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('🗓️ Agendar Aula para Turma em Espera')
            .setDescription('Selecione um dos cursos abaixo que possuem oficiais na lista de espera. Uma aula será agendada para todos os inscritos.');

        await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error("Erro ao preparar agendamento de curso:", error);
      await interaction.editReply('❌ Ocorreu um erro ao carregar os cursos com listas de espera.');
    }
  },
};