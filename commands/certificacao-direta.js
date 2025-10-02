const { SlashCommandBuilder, PermissionFlagsBits, UserSelectMenuBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('certificacao-direta')
        .setDescription('Certifica um oficial em um curso usando menus interativos.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const userSelectMenu = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('direct_certify_user_select')
                .setPlaceholder('Selecione o oficial para certificar...')
        );

        await interaction.reply({
            content: '**Etapa 1 de 2:** Selecione o oficial que deseja certificar.',
            components: [userSelectMenu],
            ephemeral: true
        });
    },
};