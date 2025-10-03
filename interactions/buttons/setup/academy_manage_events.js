const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'academy_manage_events',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const now = Math.floor(Date.now() / 1000);

        // --- INÍCIO DA CORREÇÃO ---
        // A consulta agora busca por aulas com status 'agendada' OU 'iniciando'.
        const scheduledEvents = await db.all(`
            SELECT event_id, title, event_time 
            FROM academy_events 
            WHERE event_time > $1 AND (status = 'agendada' OR status = 'iniciando')
            ORDER BY event_time ASC`, 
        [now]);
        // --- FIM DA CORREÇÃO ---

        if (scheduledEvents.length === 0) {
            return await interaction.editReply('Não há aulas futuras agendadas para gerenciar.');
        }

        const options = scheduledEvents.map(event => ({
            label: event.title,
            description: `Agendada para: ${new Date(event.event_time * 1000).toLocaleString('pt-BR')}`,
            value: event.event_id.toString(),
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('academy_manage_event_select')
            .setPlaceholder('Selecione uma aula agendada para gerenciar...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const embed = new EmbedBuilder()
            .setColor('Purple')
            .setTitle('🔧 Gerenciador de Aulas Agendadas')
            .setDescription('Selecione uma aula no menu abaixo para editar seus detalhes ou removê-la.');

        await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error("Erro ao listar aulas agendadas:", error);
      await interaction.editReply('❌ Ocorreu um erro ao carregar as aulas agendadas.');
    }
  },
};