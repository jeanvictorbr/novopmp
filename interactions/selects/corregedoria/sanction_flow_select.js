const { StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('sanction_select_'), // Captura ambos os fluxos de sanção
    async execute(interaction) {
        // Ex: sanction_select_user_123  ou sanction_select_punishment_123_456789
        const parts = interaction.customId.split('_');
        const step = parts[2];
        const ticketId = parts[3];

        try {
            // ETAPA 1 COMPLETA (usuário selecionado) -> INICIA ETAPA 2
            if (step === 'user') {
                const sanctionedUserId = interaction.values[0];
                const punishments = await db.all('SELECT name, description FROM corregedoria_punishments');
                
                if (punishments.length === 0) {
                    return await interaction.update({ content: '❌ Nenhuma punição pré-definida encontrada. Adicione punições no menu de setup.', components: [] });
                }
                const punishmentOptions = punishments.map(p => ({ label: p.name, description: p.description.substring(0, 100), value: p.name }));

                const punishmentSelectMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`sanction_select_punishment_${ticketId}_${sanctionedUserId}`)
                        .setPlaceholder('Selecione a punição a ser aplicada...')
                        .addOptions(punishmentOptions)
                );

                const content = ticketId === '0' 
                    ? '**Sanção Direta (Etapa 2 de 3):** Agora, selecione a sanção.'
                    : '**Etapa 2 de 3:** Agora, selecione a sanção a ser aplicada.';

                await interaction.update({ content, components: [punishmentSelectMenu] });
            
            // ETAPA 2 COMPLETA (punição selecionada) -> INICIA ETAPA 3
            } else if (step === 'punishment') {
                const sanctionedUserId = parts[4];
                const sanctionType = interaction.values[0];

                const modal = new ModalBuilder()
                    .setCustomId(`corregedoria_sanction_modal_${ticketId}_${sanctionedUserId}_${encodeURIComponent(sanctionType)}`)
                    .setTitle('Formulário de Justificativa');

                const reasonInput = new TextInputBuilder().setCustomId('sanction_reason').setLabel("Justificativa e Veredito Final").setStyle(TextInputStyle.Paragraph).setPlaceholder("Descreva o motivo detalhado...").setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
                await interaction.showModal(modal);
            }
        } catch (error) {
            console.error('Erro no fluxo de sanção:', error);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao processar esta etapa.', ephemeral: true }).catch(() => {});
        }
    }
};