const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_edit_course_select',
  async execute(interaction) {
    const courseId = interaction.values[0];
    
    try {
      const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
      if (!course) {
        return await interaction.reply({ content: '❌ Curso não encontrado.', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId('academy_edit_course_modal')
        .setTitle(`Editar Curso: ${course.name}`);

      const courseNameInput = new TextInputBuilder()
        .setCustomId('course_name')
        .setLabel('Nome do Curso')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(course.name);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('course_description')
        .setLabel('Descrição (O que o curso ensina?)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(course.description);
        
      const requiredHoursInput = new TextInputBuilder()
        .setCustomId('required_hours')
        .setLabel('Horas Min. Patrulha (opcional)') // CORREÇÃO: Rótulo encurtado para <= 45 chars
        .setPlaceholder('Ex: 50 (somente números)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(course.required_hours.toString());
        
      const courseIdHidden = new TextInputBuilder()
        .setCustomId('course_id_hidden')
        .setLabel('ID (não editável)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(course.course_id);

      modal.addComponents(
        new ActionRowBuilder().addComponents(courseNameInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(requiredHoursInput),
        new ActionRowBuilder().addComponents(courseIdHidden)
      );

      await interaction.showModal(modal);

    } catch (error) {
      console.error("Erro ao carregar modal de edição:", error);
      await interaction.reply({ content: '❌ Ocorreu um erro ao carregar o formulário de edição.', ephemeral: true });
    }
  },
};