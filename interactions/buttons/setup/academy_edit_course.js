const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_edit_course',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const courses = await db.all('SELECT * FROM academy_courses');
      if (courses.length === 0) {
        return await interaction.editReply('❌ Não há cursos para editar.');
      }
      
      const options = courses.map(c => ({
        label: c.name,
        description: `ID: ${c.course_id}`,
        value: c.course_id,
      }));
      
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('academy_edit_course_select')
        .setPlaceholder('Escolha um curso para editar...');
      
      selectMenu.addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      
      await interaction.editReply({ 
        content: 'Selecione o curso que você deseja editar:',
        components: [row]
      });

    } catch (error) {
      console.error("Erro ao preparar a edição de curso:", error);
      await interaction.editReply('❌ Ocorreu um erro ao preparar a lista de cursos para edição.');
    }
  },
};