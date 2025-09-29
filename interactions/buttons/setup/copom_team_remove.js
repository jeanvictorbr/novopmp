const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
// ALTERAÇÃO: Importamos o objeto 'db' em vez da função 'openDb'.
const db = require('../../../database/db.js');

module.exports = {
  customId: 'copom_team_remove',
  async execute(interaction) {
    try {
      // ALTERAÇÃO: Não usamos mais openDb() nem closeDb().
      const teams = await db.all('SELECT * FROM patrol_teams');
      
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('copom_team_remove_select')
        .setPlaceholder('Selecione uma equipe para remover...')
        .addOptions(teams.map(t => ({ 
          label: t.team_name, 
          description: `Canal ID: ${t.channel_id}`, 
          value: t.channel_id 
        })));
        
      await interaction.update({ components: [new ActionRowBuilder().addComponents(selectMenu)] });
    } catch (error) {
      console.error("Erro ao preparar remoção de equipe:", error);
      await interaction.update({ content: "Ocorreu um erro ao buscar as equipes.", components: [], embeds: [] });
    }
  },
};