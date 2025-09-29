const { RoleSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    customId: (customId) => customId.startsWith('promote_select_'),
    async execute(interaction) {
        const parts = interaction.customId.split('_');
        const step = parts[2];
        
        // Etapa 1: Usuário foi selecionado. Pede o novo cargo.
        if (step === 'user') {
            const userId = interaction.values[0];
            const menu = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId(`promote_select_newrole_${userId}`)
                    .setPlaceholder('Selecione o NOVO cargo do oficial...')
            );
            await interaction.update({ content: '**Etapa 2 de 3:** Selecione o novo cargo que o oficial receberá.', components: [menu] });
        }
        
        // Etapa 2: Novo cargo foi selecionado. Pede a justificativa (último passo).
        if (step === 'newrole') {
            const userId = parts[3];
            const newRoleId = interaction.values[0];
            
            const modal = new ModalBuilder()
                .setCustomId(`promote_modal_${userId}_${newRoleId}`)
                .setTitle('Justificativa da Promoção');
                
            const reasonInput = new TextInputBuilder()
                .setCustomId('promotion_reason')
                .setLabel("Motivo da Promoção")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Descreva os méritos e a razão pela qual o oficial está sendo promovido.")
                .setRequired(true);
                
            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        }
    }
};