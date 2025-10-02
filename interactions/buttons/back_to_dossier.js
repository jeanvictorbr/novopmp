const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { generateDossieEmbed } = require('../../commands/dossie.js');

module.exports = {
    customId: 'back_to_dossier',
    async execute(interaction) {
        // --- CORREÇÃO APLICADA AQUI ---
        // Usa deferUpdate() para garantir que a mensagem existente é editada
        await interaction.deferUpdate();

        try {
            // A lógica interna é a mesma do my_status.js
            const dossieEmbed = await generateDossieEmbed(interaction.user, interaction.guild);

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('show_career_progress')
                    .setLabel('Ver Status de Upamento')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📈')
            );

            // Edita a mensagem com a embed do dossiê e o botão para ver o progresso
            await interaction.editReply({ embeds: [dossieEmbed], components: [actionRow] });

        } catch (error) {
            console.error("Erro ao voltar para o dossiê:", error);
            await interaction.editReply({ content: "Ocorreu um erro ao buscar suas informações.", embeds: [], components: [] });
        }
    },
};