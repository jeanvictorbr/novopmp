const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('edit_sanction_modal_'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const sanctionId = interaction.customId.split('_').pop();
        const newReason = interaction.fields.getTextInputValue('sanction_reason_input');

        try {
            await db.run('UPDATE corregedoria_sanctions SET reason = $1 WHERE sanction_id = $2', [newReason, sanctionId]);
            await interaction.editReply({ content: `✅ Justificativa da sanção (ID: ${sanctionId}) atualizada com sucesso! Use /dossie novamente para ver as alterações.` });
        } catch (error) {
            console.error('Erro ao editar sanção:', error);
            await interaction.editReply('❌ Ocorreu um erro ao salvar a nova justificativa.');
        }
    }
};