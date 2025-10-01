const { EmbedBuilder } = require('discord.js');
// CORREÇÃO: O caminho foi ajustado de '../../../' para '../../' para encontrar a pasta correta.
const db = require('../../database/db.js');
const { updateAcademyPanel } = require('../../utils/updateAcademyPanel.js');
const { SETUP_FOOTER_TEXT, SETUP_FOOTER_ICON_URL } = require('../../views/setup_views.js');

module.exports = {
  customId: (id) => id.startsWith('academy_schedule_course_modal'), // Ajustado para lidar com IDs dinâmicos, se necessário
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

      const eventTimestamp = Math.floor(eventTime.getTime() / 1000);

      await db.run(
        'INSERT INTO academy_events (course_id, guild_id, scheduled_by, scheduled_at, event_time, title) VALUES ($1, $2, $3, $4, $5, $6)',
        [courseId, interaction.guild.id, interaction.user.id, Math.floor(Date.now() / 1000), eventTimestamp, title]
      );
      
      if (course.thread_id) {
        const thread = await interaction.guild.channels.fetch(course.thread_id).catch(() => null);
        if (thread) {
            const enrollments = await db.all('SELECT user_id FROM academy_enrollments WHERE course_id = $1', [courseId]);
            const mentionString = enrollments.map(e => `<@${e.user_id}>`).join(' ');

            const notificationEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('📢 Nova Aula Agendada!')
                .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setDescription(`Atenção, turma! Uma nova aula para o curso **${course.name}** foi agendada.`)
                .addFields(
                    { name: 'Aula', value: title, inline: true },
                    { name: 'Instrutor', value: interaction.user.toString(), inline: true },
                    { name: 'Data', value: `<t:${eventTimestamp}:F> (<t:${eventTimestamp}:R>)` }
                )
                .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });
            
            await thread.send({ content: mentionString.length > 0 ? `Atenção, inscritos: ${mentionString}` : 'Nova aula agendada!', embeds: [notificationEmbed] });
        }
      }

      await updateAcademyPanel(interaction.client);
      await interaction.editReply({ content: `✅ Aula **"${title}"** agendada e turma notificada com sucesso! O painel público foi atualizado.` });
      
    } catch (error) {
      console.error("Erro ao agendar o curso:", error);
      await interaction.editReply('❌ Ocorreu um erro ao processar o agendamento.');
    }
  },
};