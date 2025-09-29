const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customId: 'academy_add_course',
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('academy_add_course_modal')
      .setTitle('Adicionar Novo Curso');

    const courseIdInput = new TextInputBuilder()
      .setCustomId('course_id')
      .setLabel('ID do Curso (Ex: C-TATICOS)')
      .setPlaceholder('Deve ser único e sem espaços.')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const courseNameInput = new TextInputBuilder()
      .setCustomId('course_name')
      .setLabel('Nome do Curso (Ex: Curso de Táticas)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('course_description')
      .setLabel('Descrição (O que o curso ensina?)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);
      
    const requiredHoursInput = new TextInputBuilder()
      .setCustomId('required_hours')
      .setLabel('Horas Mínimas de Patrulha para Inscrição')
      .setPlaceholder('Ex: 50 (somente números, opcional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(courseIdInput),
      new ActionRowBuilder().addComponents(courseNameInput),
      new ActionRowBuilder().addComponents(descriptionInput),
      new ActionRowBuilder().addComponents(requiredHoursInput)
    );

    await interaction.showModal(modal);
  },
};