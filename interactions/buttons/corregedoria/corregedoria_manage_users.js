const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'corregedoria_manage_users',
    async execute(interaction) {
        // Pega o ticket do banco de dados para garantir que ele existe
        const ticket = await db.get('SELECT * FROM corregedoria_tickets WHERE channel_id = $1', [interaction.channel.id]);
        if (!ticket) {
            return await interaction.reply({ content: '❌ Este ticket não foi encontrado no banco de dados.', ephemeral: true });
        }

        // Cria o painel de gerenciamento de membros
        const embed = new EmbedBuilder()
            .setColor('Greyple')
            .setTitle('👤 Gerenciamento de Membros do Ticket')
            .setDescription('Use os botões abaixo para adicionar ou remover membros deste canal de investigação. Apenas membros adicionados e a corregedoria terão acesso.');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`corregedoria_add_user_${ticket.ticket_id}`)
                .setLabel('Adicionar Membro')
                .setStyle(ButtonStyle.Success)
                .setEmoji('➕'),
            new ButtonBuilder()
                .setCustomId(`corregedoria_remove_user_${ticket.ticket_id}`)
                .setLabel('Remover Membro')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('➖'),
            new ButtonBuilder()
                .setCustomId('corregedoria_back_to_ticket') // Botão para voltar
                .setLabel('Voltar ao Ticket')
                .setStyle(ButtonStyle.Secondary)
        );

        // Responde à interação de forma efêmera (visível apenas para o corregedor)
        await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
    }
};