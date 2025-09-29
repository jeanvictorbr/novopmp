const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_certify_official',
  async execute(interaction) {
    await interaction.deferUpdate();

    try {
        const courses = await db.all('SELECT * FROM academy_courses');

        if (courses.length === 0) {
            return await interaction.editReply('❌ Não há cursos configurados na academia para certificar oficiais.');
        }

        const courseOptions = courses.map(course => ({
            label: course.name,
            description: `ID: ${course.course_id}`,
            value: course.course_id,
        }));

        const selectCourseMenu = new StringSelectMenuBuilder()
            .setCustomId('academy_certify_course_select')
            .setPlaceholder('Selecione o curso para gerenciar inscrições...')
            .addOptions(courseOptions);

        const row = new ActionRowBuilder().addComponents(selectCourseMenu);

        await interaction.editReply({
            content: 'Selecione um curso para ver a lista de inscritos e certificar oficiais:',
            components: [row]
        });
    } catch (error) {
      console.error("Erro ao exibir dashboard de certificação:", error);
      await interaction.editReply('❌ Ocorreu um erro ao carregar o dashboard de certificação.');
    }
  },
};