const { SlashCommandBuilder, PermissionsBitField, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'uncertify_cancel',
    async execute(interaction) {
        // Simplesmente executa a lógica inicial do comando novamente
        const dessertificarCommand = interaction.client.commands.get('dessertificar');
        if (dessertificarCommand) {
            await interaction.deferUpdate();
            await dessertificarCommand.execute(interaction);
        } else {
            await interaction.update({ content: 'Ação cancelada.', embeds: [], components: [] });
        }
    }
};