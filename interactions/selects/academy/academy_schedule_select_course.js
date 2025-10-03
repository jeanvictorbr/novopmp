const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_schedule_select_course',
  async execute(interaction) {
    const courseId = interaction.values[0];
    const course = await db.get('SELECT name FROM academy_courses WHERE course_id = $1', [courseId]);

    if (!course) {
      return await interaction.reply({ content: '❌ O curso selecionado não foi encontrado.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      // O ID do modal agora inclui o ID do curso para ser pego pelo próximo handler
      .setCustomId(`academy_schedule_course_modal|${courseId}`)
      .setTitle(`Agendar Aula para: ${course.name}`);

    const titleInput = new TextInputBuilder()
      .setCustomId('event_title')
      .setLabel('Título da Aula/Evento')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Aula Introdutória de Patrulhamento')
      .setRequired(true);

    const dateInput = new TextInputBuilder()
      .setCustomId('event_date')
      .setLabel('Data da Aula (DD/MM/AAAA)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 25/12/2025')
      .setRequired(true);

    const timeInput = new TextInputBuilder()
      .setCustomId('event_time')
      .setLabel('Horário da Aula (HH:MM)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 20:30')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(dateInput),
      new ActionRowBuilder().addComponents(timeInput)
    );

    // Mostra o formulário para o usuário
    await interaction.showModal(modal);
  },
};