const db = require('../../../database/db.js');
const { updateAcademyPanel } = require('../../../utils/updateAcademyPanel.js');

module.exports = {
  customId: (id) => id.startsWith('academy_edit_event_modal'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const [, eventId] = interaction.customId.split('|');
    const title = interaction.fields.getTextInputValue('event_title');
    const dateString = interaction.fields.getTextInputValue('event_date');
    const timeString = interaction.fields.getTextInputValue('event_time');

    try {
      const [day, month, year] = dateString.split('/').map(Number);
      const [hour, minute] = timeString.split(':').map(Number);
      const eventTime = new Date(year, month - 1, day, hour, minute);

      if (isNaN(eventTime.getTime())) return await interaction.editReply('❌ Data ou horário inválido.');

      await db.run(
        'UPDATE academy_events SET title = $1, event_time = $2 WHERE event_id = $3',
        [title, Math.floor(eventTime.getTime() / 1000), eventId]
      );
      
      await updateAcademyPanel(interaction.client);
      await interaction.editReply({ content: '✅ Aula atualizada com sucesso! O painel público foi sincronizado.' });

    } catch (error) {
      console.error("Erro ao editar evento:", error);
      await interaction.editReply('❌ Ocorreu um erro ao salvar as alterações.');
    }
  },
};