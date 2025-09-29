const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

// Função para converter segundos de volta para o formato de string (ex: 7d, 12h, 30m)
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '';
    if (seconds % 86400 === 0) return `${seconds / 86400}d`;
    if (seconds % 3600 === 0) return `${seconds / 3600}h`;
    if (seconds % 60 === 0) return `${seconds / 60}m`;
    return `${seconds}s`; // Fallback
}

module.exports = {
    customId: 'corregedoria_punishment_edit_select',
    async execute(interaction) {
        const punishmentName = interaction.values[0];
        
        try {
            // CORREÇÃO: Busca a punição pelo nome.
            const punishment = await db.get('SELECT * FROM corregedoria_punishments WHERE name = $1', [punishmentName]);
            if (!punishment) {
                return await interaction.reply({ content: '❌ Punição não encontrada.', ephemeral: true });
            }

            const modal = new ModalBuilder()
                // CORREÇÃO: Usa o nome (codificado) no ID do modal para encontrá-lo depois.
                .setCustomId(`corregedoria_punishment_edit_modal_${encodeURIComponent(punishment.name)}`)
                .setTitle(`Editar Punição`);

            const nameInput = new TextInputBuilder()
                .setCustomId('punishment_name')
                .setLabel("Nome da Punição")
                .setStyle(TextInputStyle.Short)
                .setValue(punishment.name)
                .setRequired(true);

            const descriptionInput = new TextInputBuilder()
                .setCustomId('punishment_description')
                .setLabel("Descrição")
                .setStyle(TextInputStyle.Paragraph)
                .setValue(punishment.description)
                .setRequired(true);
                
            const durationInput = new TextInputBuilder()
                .setCustomId('punishment_duration')
                .setLabel("Duração (Ex: 7d, 24h, 30m) - Opcional")
                .setStyle(TextInputStyle.Short)
                .setValue(formatDuration(punishment.duration_seconds))
                .setPlaceholder("Deixe em branco para uma punição permanente.")
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(descriptionInput),
                new ActionRowBuilder().addComponents(durationInput)
            );

            await interaction.showModal(modal);

        } catch (error) {
            console.error("Erro ao carregar modal de edição de punição:", error);
            await interaction.reply({ content: '❌ Ocorreu um erro ao carregar o formulário.', ephemeral: true });
        }
    },
};