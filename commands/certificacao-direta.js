const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('certificacao-direta')
        .setDescription('Certifica um oficial em um curso sem a necessidade de inscrição prévia.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('direct_certify_modal')
            .setTitle('Certificação Direta');

        const courseIdInput = new TextInputBuilder()
            .setCustomId('course_id')
            .setLabel("ID do Curso")
            .setPlaceholder("Ex: C-TATICOS")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const userIdInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel("ID do Oficial a ser Certificado")
            .setPlaceholder("Copie e cole o ID do Discord do membro")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(courseIdInput),
            // --- CORREÇÃO AQUI ---
            new ActionRowBuilder().addComponents(userIdInput) // Estava "ActionRowRowBuilder"
        );

        await interaction.showModal(modal);
    },
};