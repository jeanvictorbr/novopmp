const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'edit_sanction_select',
    async execute(interaction) {
        const sanctionId = interaction.values[0];
        const sanction = await db.get('SELECT reason FROM corregedoria_sanctions WHERE sanction_id = $1', [sanctionId]);

        if (!sanction) {
            return await interaction.reply({ content: '❌ Sanção não encontrada.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`edit_sanction_modal_${sanctionId}`)
            .setTitle('Editar Justificativa da Sanção');

        const reasonInput = new TextInputBuilder()
            .setCustomId('sanction_reason_input')
            .setLabel('Justificativa')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(sanction.reason)
            .setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    }
};