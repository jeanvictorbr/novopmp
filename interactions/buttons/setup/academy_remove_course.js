const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_remove_course',
  async execute(interaction) {
    
    const courses = await db.all('SELECT * FROM academy_courses');
    
    if (courses.length === 0) {
      return await interaction.reply({ content: '❌ Não há cursos para remover.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('academy_remove_course_modal')
      .setTitle('Remover Curso');

    const courseIdInput = new TextInputBuilder()
      .setCustomId('course_id')
      .setLabel('ID do Curso')
      .setPlaceholder('Ex: C-TATICOS')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(courseIdInput));

    await interaction.showModal(modal);
  },
};