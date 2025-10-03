const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { updateAcademyPanel } = require('../../utils/updateAcademyPanel.js');

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

      const eventTimestamp = Math.floor(eventTime.getTime() / 1000);

      // Atualiza a query para incluir o status inicial
      await db.run(
        'INSERT INTO academy_events (course_id, guild_id, scheduled_by, scheduled_at, event_time, title, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [courseId, interaction.guild.id, interaction.user.id, Math.floor(Date.now() / 1000), eventTimestamp, title, 'agendada']
      );
      
      if (course.thread_id) {
        const thread = await interaction.guild.channels.fetch(course.thread_id).catch(() => null);
        if (thread) {
            const enrollments = await db.all('SELECT user_id FROM academy_enrollments WHERE course_id = $1', [courseId]);
            const mentionString = enrollments.map(e => `<@${e.user_id}>`).join(' ');

            // --- A NOVA EMBED DE ANÚNCIO ---
            const notificationEmbed = new EmbedBuilder()
                .setColor('Gold')
                .setTitle('📢 BOAS NOTÍCIAS, TURMA! 📢')
                .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setDescription(`O curso de **${course.name}** foi agendado!`)
                .addFields(
                    { name: 'Instrutor', value: interaction.user.toString(), inline: true },
                    { name: 'Data e Hora', value: `<t:${eventTimestamp}:F> (<t:${eventTimestamp}:R>)`, inline: true },
                    { name: 'REGRAS IMPORTANTES', value: '> **1.** 30 minutos antes da aula, um canal de voz será criado e postado aqui.\n> **2.** A presença no canal de voz será **obrigatória** nos primeiros 20 minutos.\n> **3.** Ausentes terão a inscrição cancelada automaticamente.' }
                )
                .setFooter({ text: 'Preparem-se, oficiais!' });
            
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