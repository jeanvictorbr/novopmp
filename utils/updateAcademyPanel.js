const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db.js');

async function updateAcademyPanel(client) {
  try {
    const panelInfo = await db.get('SELECT * FROM panels WHERE panel_type = $1', ['academy']);
    if (!panelInfo) return;

    const channel = await client.channels.fetch(panelInfo.channel_id).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(panelInfo.message_id).catch(() => null);
    if (!message) return;

    // Busca eventos agendados que ainda não aconteceram
    const now = Math.floor(Date.now() / 1000);
    const scheduledEvents = await db.all(
      `SELECT ae.*, ac.name 
       FROM academy_events ae 
       JOIN academy_courses ac ON ae.course_id = ac.course_id 
       WHERE ae.event_time > $1 AND ae.status = 'scheduled' 
       ORDER BY ae.event_time ASC`,
      [now]
    );

    const embed = new EmbedBuilder()
      .setColor('Gold')
      .setTitle('🎓 Academia de Polícia - Central de Cursos')
      .setDescription('Bem-vindo, oficial! Aqui você pode se inscrever para as próximas aulas ou solicitar um curso do nosso catálogo para futuras turmas.')
      .setThumbnail('https://i.imgur.com/ywhAV0k.png')
      .setImage('https://i.imgur.com/z4PE1f6.jpeg');

    if (scheduledEvents.length > 0) {
      let eventsDescription = '';
      scheduledEvents.forEach(event => {
        eventsDescription += `\n**Aula:** ${event.title}\n**Curso:** ${event.name}\n**Data:** <t:${event.event_time}:F> (<t:${event.event_time}:R>)\n\n`;
      });
      embed.addFields({ name: '🗓️ Próximas Aulas Agendadas', value: eventsDescription });
    } else {
      embed.addFields({ name: '🗓️ Próximas Aulas Agendadas', value: '`Nenhuma aula agendada no momento. Solicite um curso do catálogo!`' });
    }

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('academy_show_catalog')
        .setLabel('Listar Todos os Cursos (Catálogo)')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📚')
    );

    await message.edit({ content: '', embeds: [embed], components: [buttons] });
  } catch (error) {
    console.error("Falha ao atualizar o painel da Academia:", error);
  }
}

module.exports = { updateAcademyPanel };