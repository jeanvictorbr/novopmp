const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'corregedoria_apply_sanction',
    async execute(interaction) {
        try {
            const ticket = await db.get('SELECT ticket_id FROM corregedoria_tickets WHERE channel_id = $1', [interaction.channel.id]);
            if (!ticket) {
                return await interaction.reply({ content: '❌ Ticket não encontrado no banco de dados.', ephemeral: true });
            }

            // Apenas cria e envia o menu de seleção de usuário.
            // O ID agora contém o número do ticket para ser pego pelo novo handler.
            const userSelectMenu = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(`sanction_select_user_${ticket.ticket_id}`)
                    .setPlaceholder('Selecione o oficial a ser punido...')
            );
            
            await interaction.reply({
                content: '**Etapa 1 de 3:** Selecione o membro que receberá a sanção.',
                components: [userSelectMenu],
                ephemeral: true,
            });

        } catch (error) {
            console.error("Erro ao iniciar fluxo de sanção via ticket:", error);
            await interaction.reply({ content: '❌ Ocorreu um erro ao iniciar este processo.', ephemeral: true });
        }
    }
};