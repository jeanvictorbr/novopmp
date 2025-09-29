const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

module.exports = {
    customId: 'corregedoria_direct_sanction',
    async execute(interaction) {
        try {
            const ticketId = 0; // Placeholder para sanção direta

            // Apenas cria e envia o menu de seleção de usuário.
            // O ID contém '0' para indicar que é uma sanção direta.
            const userSelectMenu = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(`sanction_select_user_${ticketId}`)
                    .setPlaceholder('Selecione o oficial a ser punido...')
            );
            
            await interaction.reply({
                content: '**Sanção Direta (Etapa 1 de 3):** Selecione o membro que receberá a sanção.',
                components: [userSelectMenu],
                ephemeral: true
            });

        } catch (error) {
            console.error("Erro ao iniciar sanção direta:", error);
            await interaction.reply({ content: '❌ Ocorreu um erro ao iniciar este processo.', ephemeral: true });
        }
    }
};