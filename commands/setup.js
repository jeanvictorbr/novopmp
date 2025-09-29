const { SlashCommandBuilder, PermissionsBitField, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');
const { getMainMenuPayload } = require('../views/setup_views.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Abre a central de configurações interativa do Phoenix.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const payload = await getMainMenuPayload(db);
      await interaction.editReply(payload);
    } catch (error) {
      console.error("Erro ao carregar o menu principal:", error);
      await interaction.editReply('❌ Ocorreu um erro ao carregar o menu de configuração. Por favor, tente novamente.');
    }
  },
};