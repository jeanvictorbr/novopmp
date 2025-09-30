const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../database/db.js');
const { updateAcademyPanel } = require('../../../utils/updateAcademyPanel.js');

module.exports = {
  customId: (id) => id.startsWith('academy_remove_event'),
  async execute(interaction) {
    const parts = interaction.customId.split('|');

    // Botão inicial: customId é 'academy_remove_event|{eventId}'
    if (parts.length === 2) { 
        const eventId = parts[1];
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`academy_remove_event|confirm|${eventId}`).setLabel('Sim, Cancelar Aula').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('delete_cancel').setLabel('Não').setStyle(ButtonStyle.Secondary)
        );
        // Usamos update() porque esta interação vem de um menu de seleção anterior
        await interaction.update({ content: 'Você tem certeza que deseja cancelar esta aula agendada? Esta ação é irreversível.', components: [row], embeds: [] });
    } 
    // Botão de confirmação: customId é 'academy_remove_event|confirm|{eventId}'
    else if (parts.length === 3 && parts[1] === 'confirm') {
        await interaction.deferUpdate();
        const eventId = parts[2]; // CORREÇÃO: Pega a terceira parte (o ID numérico)
        
        await db.run('DELETE FROM academy_events WHERE event_id = $1', [eventId]);
        
        await updateAcademyPanel(interaction.client);
        await interaction.editReply({ content: '✅ Aula cancelada e removida do painel com sucesso.', components: [], embeds: [] });
    }
  },
};