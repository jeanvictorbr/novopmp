const { ActionRowBuilder, UserSelectMenuBuilder, ComponentType, EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');
const { logCorregedoriaEvent } = require('../../../utils/corregedoria/eventLogger.js');
const { updateCorregedoriaDashboard } = require('../../../utils/corregedoria/dashboardUpdater.js');

module.exports = {
    customId: (customId) => customId.startsWith('corregedoria_add_user_'),
    async execute(interaction) {
        const selectMenu = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('corregedoria_add_user_select')
                .setPlaceholder('Selecione o membro que deseja adicionar...')
        );

        const response = await interaction.update({
            content: 'Selecione abaixo o usuário que você deseja adicionar a este ticket.',
            components: [selectMenu],
            embeds: []
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.UserSelect,
            filter: i => i.user.id === interaction.user.id,
            time: 60000,
            max: 1
        });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const memberIdToAdd = i.values[0];
            const memberToAdd = await interaction.guild.members.fetch(memberIdToAdd);

            await interaction.channel.permissionOverwrites.edit(memberToAdd.id, {
                ViewChannel: true,
                SendMessages: true
            });
            
            const ticketId = interaction.customId.split('_').pop();
            await logCorregedoriaEvent(ticketId, 'membro_adicionado', `O usuário ${memberToAdd.toString()} foi **adicionado** ao ticket por <@${interaction.user.id}>.`, interaction.user.id);
            await updateCorregedoriaDashboard(interaction, ticketId);

            await interaction.channel.send(`✅ O usuário ${memberToAdd.toString()} foi adicionado a este canal por ${interaction.user.toString()}.`);
            await i.deleteReply();
        });
    }
};