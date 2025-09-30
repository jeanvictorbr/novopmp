const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_schedule_independent',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const allCourses = await db.all('SELECT course_id, name FROM academy_courses ORDER BY name ASC');

        if (allCourses.length === 0) {
            return await interaction.editReply('Não há cursos no catálogo para agendar uma aula avulsa.');
        }

        const options = allCourses.map(course => ({
            label: course.name,
            description: `ID do Curso: ${course.course_id}`,
            value: course.course_id,
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('academy_schedule_select_course')
            .setPlaceholder('Selecione um curso do catálogo...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('📅 Agendar Aula Avulsa')
            .setDescription('Selecione um curso do catálogo para agendar uma nova aula, independentemente da lista de espera.');

        await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error("Erro ao preparar agendamento de aula avulsa:", error);
      await interaction.editReply('❌ Ocorreu um erro ao carregar os cursos.');
    }
  },
};