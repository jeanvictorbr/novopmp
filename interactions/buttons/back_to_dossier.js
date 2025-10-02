const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { generateDossieEmbed } = require('../../commands/dossie.js');

module.exports = {
    customId: 'back_to_dossier',
    async execute(interaction) {
        await interaction.deferUpdate();

        try {
            const dossieEmbed = await generateDossieEmbed(interaction.user, interaction.guild);

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('show_career_progress')
                    .setLabel('Status de Upamento')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📈'),
                // --- NOVO BOTÃO ADICIONADO ---
                new ButtonBuilder()
                    .setCustomId('show_achievements_dashboard')
                    .setLabel('Ver Conquistas')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🏅')
            );

            await interaction.editReply({ embeds: [dossieEmbed], components: [actionRow] });

        } catch (error) {
            console.error("Erro ao voltar para o dossiê:", error);
            await interaction.editReply({ content: "Ocorreu um erro ao buscar suas informações.", embeds: [], components: [] });
        }
    },
};