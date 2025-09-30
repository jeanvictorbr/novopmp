const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('recadogeral')
        .setDescription('Envia uma mensagem privada para todos os membros do servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Apenas administradores podem usar
    
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('recado_geral_modal')
            .setTitle('📢 Recado Geral para o Servidor');

        const messageInput = new TextInputBuilder()
            .setCustomId('recado_geral_input')
            .setLabel("Mensagem a ser enviada")
            .setStyle(TextInputStyle.Paragraph) // Campo de texto longo
            .setPlaceholder('Escreva aqui o comunicado que será enviado para todos os membros. Você pode usar markdown como **negrito**.')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(messageInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    },
};