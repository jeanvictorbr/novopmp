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

    // --- INÍCIO DA MODIFICAÇÃO ---
    // Pega a data e hora atuais e ajusta para o fuso de Brasília (UTC-3)
    const now = new Date();
    now.setHours(now.getUTCHours() - 3);

    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Mês é indexado em 0
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const currentDate = `${day}/${month}/${year}`;
    const currentTime = `${hours}:${minutes}`;
    // --- FIM DA MODIFICAÇÃO ---

    const modal = new ModalBuilder()
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
      .setValue(currentDate) // Campo pré-preenchido
      .setRequired(true);

    const timeInput = new TextInputBuilder()
      .setCustomId('event_time')
      .setLabel('Horário (HH:MM) - Fuso de Brasília') // Adicionado aviso de fuso
      .setStyle(TextInputStyle.Short)
      .setValue(currentTime) // Campo pré-preenchido
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(dateInput),
      new ActionRowBuilder().addComponents(timeInput)
    );

    await interaction.showModal(modal);
  },
};