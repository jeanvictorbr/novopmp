const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customId: 'academy_schedule_select_course',
  async execute(interaction) {
    const courseId = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`academy_schedule_course_modal|${courseId}`)
      .setTitle('Agendar Aula para Turma');

    const titleInput = new TextInputBuilder()
      .setCustomId('event_title')
      .setLabel('Título da Aula (Ex: Aula Teórica de Patrulha)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    const dateInput = new TextInputBuilder()
      .setCustomId('event_date')
      .setLabel('Data (DD/MM/AAAA)')
      .setPlaceholder('Ex: 25/12/2025')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const timeInput = new TextInputBuilder()
      .setCustomId('event_time')
      .setLabel('Horário (HH:MM)')
      .setPlaceholder('Ex: 14:00 (Formato 24h)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(dateInput),
      new ActionRowBuilder().addComponents(timeInput)
    );

    await interaction.showModal(modal);
  },
};