const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_schedule_course',
  async execute(interaction) {
    // CORREÇÃO: Removemos o deferReply para evitar o erro.
    // await interaction.deferReply({ ephemeral: true });

    try {
      const courses = await db.all('SELECT * FROM academy_courses');
      if (courses.length === 0) {
        return await interaction.reply({ content: '❌ Não há cursos para agendar. Adicione um curso primeiro.', ephemeral: true });
      }
      
      const modal = new ModalBuilder()
        .setCustomId('academy_schedule_course_modal')
        .setTitle('Agendar Novo Curso');

      // Campos do formulário para agendar o curso
      const courseIdInput = new TextInputBuilder()
        .setCustomId('course_id')
        .setLabel('ID do Curso (Ex: C-TATICOS)')
        .setPlaceholder('ID do curso que você quer agendar.')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const titleInput = new TextInputBuilder()
        .setCustomId('event_title')
        .setLabel('Título da Aula (Ex: Aula Teórica de Patrulha)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      
      const descriptionInput = new TextInputBuilder()
        .setCustomId('event_description')
        .setLabel('Descrição da Aula')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);
      
      const dateInput = new TextInputBuilder()
        .setCustomId('event_date')
        .setLabel('Data (DD/MM/AAAA)')
        .setPlaceholder('Ex: 28/09/2025')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const timeInput = new TextInputBuilder()
        .setCustomId('event_time')
        .setLabel('Horário (HH:MM)')
        .setPlaceholder('Ex: 14:00 (Formato 24h)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(courseIdInput),
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(dateInput),
        new ActionRowBuilder().addComponents(timeInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      console.error("Erro ao preparar o agendamento de curso:", error);
      await interaction.reply({ content: '❌ Ocorreu um erro ao preparar o agendamento de curso.', ephemeral: true });
    }
  },
};