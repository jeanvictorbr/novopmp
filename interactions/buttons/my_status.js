const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { generateDossieEmbed } = require('../../commands/dossie.js'); // Importa a função central

module.exports = {
    customId: 'my_status',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Gera a embed do dossiê como antes
            const dossieEmbed = await generateDossieEmbed(interaction.user, interaction.guild);

            // --- NOVA INTEGRAÇÃO ---
            // Cria a nova linha de botões com a funcionalidade de ver o progresso
            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('show_career_progress') // ID para o novo handler
                    .setLabel('Ver Status de Upamento')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📈')
            );

            // Envia a embed do dossiê com o novo botão
            await interaction.editReply({ embeds: [dossieEmbed], components: [actionRow] });

        } catch (error) {
            console.error("Erro ao gerar dossiê de status pessoal:", error);
            await interaction.editReply({ content: "Ocorreu um erro ao buscar suas informações." });
        }
    },
};