module.exports = {
    customId: 'corregedoria_back_to_ticket',
    async execute(interaction) {
        // CORREÇÃO: Em vez de deletar, edita a mensagem efêmera para confirmar o cancelamento.
        await interaction.update({ 
            content: 'Ação cancelada. Você pode fechar esta mensagem.', 
            embeds: [], 
            components: [] 
        });
    }
};