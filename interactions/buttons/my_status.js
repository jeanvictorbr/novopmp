const { EmbedBuilder } = require('discord.js');
const { generateDossieEmbed } = require('../../commands/dossie.js'); // Importa a função central

module.exports = {
    customId: 'my_status',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Usa a função importada, passando o usuário que clicou no botão
            const dossieEmbed = await generateDossieEmbed(interaction.user, interaction.guild);
            await interaction.editReply({ embeds: [dossieEmbed] });

        } catch (error) {
            console.error("Erro ao gerar dossiê de status pessoal:", error);
            await interaction.editReply({ content: "Ocorreu um erro ao buscar suas informações." });
        }
    },
};