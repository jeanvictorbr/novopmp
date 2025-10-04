const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db.js');
const { SETUP_EMBED_IMAGE_URL, SETUP_FOOTER_TEXT, SETUP_FOOTER_ICON_URL } = require('../views/setup_views.js');

async function updateAcademyPanel(client) {
  try {
    const panelInfo = await db.get('SELECT * FROM panels WHERE panel_type = $1', ['academy']);
    if (!panelInfo) return;

    const guild = client.guilds.cache.first();
    if (!guild) return;

    // --- CORREÇÃO APLICADA AQUI ---
    // A variável foi corrigida de 'panelinfo' para 'panelInfo'.
    const channel = await guild.channels.fetch(panelInfo.channel_id).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(panelInfo.message_id).catch(() => null);
    // --- FIM DA CORREÇÃO ---
    if (!message) return;

    const now = Math.floor(Date.now() / 1000);
    
    const scheduledEvents = await db.all(
      `SELECT ae.*, ac.name 
       FROM academy_events ae 
       JOIN academy_courses ac ON ae.course_id = ac.course_id 
       WHERE ae.status IN ('agendada', 'iniciando', 'em_progresso')
       ORDER BY ae.event_time ASC LIMIT 4`,
      []
    );

    const embed = new EmbedBuilder()
      .setColor('Gold')
      .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
      .setTitle('🎓 Academia de Polícia - Central de Cursos')
      .setDescription('Bem-vindo, oficial! Inscreva-se nas próximas aulas ou explore nosso catálogo completo de cursos.')
      .setImage(SETUP_EMBED_IMAGE_URL)
      .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });

    const components = [];
    if (scheduledEvents.length > 0) {
      let eventsDescription = '';
      const eventButtons = new ActionRowBuilder();

      scheduledEvents.forEach((event, index) => {
        let timeText;
        if (event.status === 'agendada') {
            timeText = `**Data:** <t:${event.event_time}:F> (<t:${event.event_time}:R>)`;
        } else {
            timeText = `**Status:** 🟢 Acontecendo Agora!`;
        }

        eventsDescription += `\n**${index + 1}. ${event.title}**\n**Curso:** ${event.name}\n${timeText}\n`;
        
        // Apenas adiciona o botão de inscrever se a aula ainda não começou
        if (event.status === 'agendada') {
            eventButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`academy_enroll_event|${event.event_id}`)
                    .setLabel(`Inscrever-se na Aula ${index + 1}`)
                    .setStyle(ButtonStyle.Success)
            );
        }
      });
      embed.addFields({ name: '🗓️ Próximas Aulas Agendadas', value: eventsDescription });
      if(eventButtons.components.length > 0) components.push(eventButtons);
    } else {
      embed.addFields({ name: '🗓️ Próximas Aulas Agendadas', value: '`Nenhuma aula agendada no momento. Solicite um curso do catálogo!`' });
    }

    const catalogButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('academy_show_catalog')
        .setLabel('Listar Catálogo Completo de Cursos')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📚')
    );
    components.push(catalogButton);

    await message.edit({ content: '', embeds: [embed], components: components });
  } catch (error) {
    console.error("Falha ao atualizar o painel da Academia:", error);
  }
}

module.exports = { updateAcademyPanel };