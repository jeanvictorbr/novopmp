const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_manage_event_select',
  async execute(interaction) {
    await interaction.deferUpdate();
    const eventId = interaction.values[0];

    const event = await db.get(`
        SELECT ae.*, ac.name 
        FROM academy_events ae 
        JOIN academy_courses ac ON ae.course_id = ac.course_id 
        WHERE ae.event_id = $1`, 
    [eventId]);

    if (!event) {
        return interaction.editReply({ content: 'Esta aula não foi encontrada. Pode já ter sido removida.', components: [], embeds: [] });
    }

    const embed = new EmbedBuilder()
        .setColor('Purple')
        .setTitle(`Gerenciando: ${event.title}`)
        .addFields(
            { name: 'Curso', value: event.name, inline: true },
            { name: 'ID do Evento', value: `\`${event.event_id}\``, inline: true },
            { name: 'Data Agendada', value: `<t:${event.event_time}:F>` }
        );

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`academy_edit_event|${eventId}`).setLabel('Editar Aula').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
        new ButtonBuilder().setCustomId(`academy_remove_event|${eventId}`).setLabel('Remover (Cancelar) Aula').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    await interaction.editReply({ embeds: [embed], components: [buttons] });
  },
};