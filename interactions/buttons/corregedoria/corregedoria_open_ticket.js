const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    customId: 'corregedoria_open_ticket',
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('corregedoria_ticket_modal')
            .setTitle('Formulário de Denúncia');

        const accusedMemberInput = new TextInputBuilder()
            .setCustomId('accused_member')
            .setLabel("Nome ou ID do(s) Acusado(s)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Forneça o nome de usuário ou ID do Discord do(s) envolvido(s).")
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('report_description')
            .setLabel("Descrição Detalhada da Ocorrência")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Descreva o que aconteceu com o máximo de detalhes possível. Inclua data, hora e contexto.")
            .setRequired(true);

        const evidenceInput = new TextInputBuilder()
            .setCustomId('report_evidence')
            .setLabel("Provas (Links de Imagens/Vídeos)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Cole aqui links de prints, vídeos ou outras provas. Se não houver, escreva 'Nenhuma'.")
            .setRequired(true);
            
        modal.addComponents(
            new ActionRowBuilder().addComponents(accusedMemberInput),
            new ActionRowBuilder().addComponents(descriptionInput),
            new ActionRowBuilder().addComponents(evidenceInput)
        );

        await interaction.showModal(modal);
    }
};