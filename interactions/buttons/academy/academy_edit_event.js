const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  // CORREÇÃO APLICADA AQUI
  customId: (id) => id.startsWith('academy_edit_event|'),
  async execute(interaction) {
    const [, eventId] = interaction.customId.split('|');
    const event = await db.get('SELECT * FROM academy_events WHERE event_id = $1', [eventId]);
    if (!event) return interaction.reply({ content: 'Aula não encontrada.', ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId(`academy_edit_event_modal|${eventId}`)
      .setTitle('Editar Aula Agendada');
      
    const eventDate = new Date(event.event_time * 1000);
    const dateString = eventDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeString = eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const titleInput = new TextInputBuilder().setCustomId('event_title').setLabel('Título da Aula').setStyle(TextInputStyle.Short).setValue(event.title).setRequired(true);
    const dateInput = new TextInputBuilder().setCustomId('event_date').setLabel('Data (DD/MM/AAAA)').setStyle(TextInputStyle.Short).setValue(dateString).setRequired(true);
    const timeInput = new TextInputBuilder().setCustomId('event_time').setLabel('Horário (HH:MM)').setStyle(TextInputStyle.Short).setValue(timeString).setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(dateInput),
      new ActionRowBuilder().addComponents(timeInput)
    );
    await interaction.showModal(modal);
  },
};