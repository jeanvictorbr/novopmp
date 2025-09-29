const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'copom_team_add',
  async execute(interaction) {
    try {
      // Primeiro, verificamos se a categoria para criar equipes foi definida.
      const categorySetting = await db.get('SELECT value FROM settings WHERE key = $1', ['copom_teams_category_id']);
      
      if (!categorySetting || !categorySetting.value) {
        // Se não foi, avisamos o admin e paramos a execução.
        return interaction.reply({ 
          content: '❌ Ação necessária: Por favor, defina a "Categoria das Equipes" no menu anterior antes de adicionar uma equipe.', 
          ephemeral: true 
        });
      }

      // Se a categoria existe, montamos e mostramos o formulário (modal).
      const modal = new ModalBuilder()
        .setCustomId('copom_team_add_modal')
        .setTitle('Adicionar Nova Equipe');
        
      const nameInput = new TextInputBuilder()
        .setCustomId('team_name')
        .setLabel('Nome da Equipe (Ex: Alfa, Tático 01)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
        
      const slotsInput = new TextInputBuilder()
        .setCustomId('max_slots')
        .setLabel('Número de Vagas (Padrão: 4)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
        
      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(slotsInput)
      );
      
      // Esta é a única resposta para a interação, o que evita o erro.
      await interaction.showModal(modal);

    } catch (error) {
      console.error("Erro ao executar 'copom_team_add':", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Ocorreu um erro ao tentar abrir o formulário.', ephemeral: true });
      }
    }
  },
};