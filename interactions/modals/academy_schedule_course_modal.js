const db = require('../../../database/db.js');
const { updateAcademyPanel } = require('../../../utils/updateAcademyPanel.js');

module.exports = {
  customId: (id) => id.startsWith('academy_schedule_course_modal'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const [, courseId] = interaction.customId.split('|');
    const title = interaction.fields.getTextInputValue('event_title');
    const dateString = interaction.fields.getTextInputValue('event_date');
    const timeString = interaction.fields.getTextInputValue('event_time');

    try {
      const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
      if (!course) {
        return await interaction.editReply('❌ O ID do curso fornecido não foi encontrado.');
      }
      
      const [day, month, year] = dateString.split('/').map(Number);
      const [hour, minute] = timeString.split(':').map(Number);
      const eventTime = new Date(year, month - 1, day, hour, minute);
      
      if (isNaN(eventTime.getTime()) || eventTime.getTime() < Date.now()) {
        return await interaction.editReply('❌ Data ou horário inválido. Use o formato DD/MM/AAAA e HH:MM e garanta que seja uma data futura.');
      }

      await db.run(
        'INSERT INTO academy_events (course_id, guild_id, scheduled_by, scheduled_at, event_time, title) VALUES ($1, $2, $3, $4, $5, $6)',
        [courseId, interaction.guild.id, interaction.user.id, Math.floor(Date.now() / 1000), Math.floor(eventTime.getTime() / 1000), title]
      );
      
      await updateAcademyPanel(interaction.client);
      await interaction.editReply({ content: `✅ Aula **${title}** para o curso **${course.name}** agendada com sucesso! O painel público foi atualizado.` });
      
    } catch (error) {
      console.error("Erro ao agendar o curso:", error);
      await interaction.editReply('❌ Ocorreu um erro ao processar o agendamento.');
    }
  },
};