const { EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../../database/db.js');

module.exports = {
  customId: 'academy_schedule_course_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const courseId = interaction.fields.getTextInputValue('course_id').toUpperCase();
    const title = interaction.fields.getTextInputValue('event_title');
    const description = interaction.fields.getTextInputValue('event_description');
    const dateString = interaction.fields.getTextInputValue('event_date');
    const timeString = interaction.fields.getTextInputValue('event_time');

    try {
      // 1. Validar e formatar a data
      const [day, month, year] = dateString.split('/').map(Number);
      const [hour, minute] = timeString.split(':').map(Number);
      
      const startTime = new Date(year, month - 1, day, hour, minute);
      
      if (isNaN(startTime.getTime()) || startTime.getTime() < Date.now()) {
        return await interaction.editReply('❌ Data ou horário inválido. Por favor, use o formato DD/MM/AAAA e HH:MM, e garanta que a data seja futura.');
      }

      // 2. Criar a discussão (thread) para o curso
      const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
      if (!course) {
        return await interaction.editReply('❌ O ID do curso fornecido não foi encontrado. Verifique e tente novamente.');
      }
      
      const academyChannelId = (await db.get("SELECT value FROM settings WHERE key = 'academy_channel_id'"))?.value;
      const academyChannel = interaction.guild.channels.cache.get(academyChannelId);
      
      if (!academyChannel || academyChannel.type !== ChannelType.GuildText) {
          return await interaction.editReply('❌ O canal da Academia não está configurado corretamente ou não é um canal de texto.');
      }
      
      const thread = await academyChannel.threads.create({
          name: `${course.name} - ${title}`,
          autoArchiveDuration: 60,
          reason: `Discussão para o curso agendado: ${title}`,
      });
      
      // Salvar o ID da thread no banco de dados
      await db.run('UPDATE academy_courses SET thread_id = $1 WHERE course_id = $2', [thread.id, courseId]);
      
      // 3. Obter a lista de inscritos e mencioná-los na thread
      const enrollments = await db.all('SELECT user_id FROM academy_enrollments WHERE course_id = $1', [courseId]);
      const usersToMention = enrollments.map(e => `<@${e.user_id}>`).join(', ');
      
      await thread.send({
          content: `${usersToMention.length > 0 ? usersToMention : 'Nenhum inscrito para mencionar.'}\n\n**${title}**\n${description || 'Nenhuma descrição fornecida.'}`,
          embeds: [
              new EmbedBuilder()
                  .setColor('Purple')
                  .setTitle(`🎉 Nova Aula Agendada!`)
                  .setDescription(`**Curso:** ${course.name}\n**Data:** <t:${Math.floor(startTime.getTime() / 1000)}:f>\n**Discussão:** ${thread}`)
          ]
      });

      await interaction.editReply({ 
          content: `✅ Curso agendado com sucesso! Uma discussão foi criada em ${thread}.`,
          ephemeral: true
      });
      
    } catch (error) {
      console.error("Erro ao agendar o curso:", error);
      await interaction.editReply('❌ Ocorreu um erro ao processar o agendamento do curso.');
    }
  },
};