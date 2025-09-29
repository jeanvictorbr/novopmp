const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType, EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');
const { logCorregedoriaEvent } = require('../../../utils/corregedoria/eventLogger.js');
const { updateCorregedoriaDashboard } = require('../../../utils/corregedoria/dashboardUpdater.js');

module.exports = {
    customId: (customId) => customId.startsWith('corregedoria_remove_user_'),
    async execute(interaction) {
        try {
            const permissions = interaction.channel.permissionOverwrites.cache;
            const ticket = await db.get('SELECT complainant_id FROM corregedoria_tickets WHERE channel_id = $1', [interaction.channel.id]);
            const corregedorRoleId = (await db.get("SELECT value FROM settings WHERE key = 'corregedoria_role_id'"))?.value;

            // Filtra para encontrar apenas os membros que foram adicionados manualmente
            const addedMembersIds = permissions
                .filter(p => p.type === 1 && p.id !== interaction.client.user.id && p.id !== ticket.complainant_id && p.id !== corregedorRoleId)
                .map(p => p.id);

            if (addedMembersIds.length === 0) {
                return await interaction.update({
                    content: 'ℹ️ Não há membros adicionados manualmente para remover deste ticket.',
                    embeds: [],
                    components: []
                });
            }
            
            const memberOptions = await Promise.all(
                addedMembersIds.map(async (id) => {
                    const member = await interaction.guild.members.fetch(id).catch(() => null);
                    return member ? { label: member.user.username, description: `ID: ${member.id}`, value: member.id } : null;
                })
            );

            // **CORREÇÃO APLICADA AQUI**
            // Usamos StringSelectMenuBuilder e o método correto `addOptions`
            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('corregedoria_remove_user_select_unique')
                    .setPlaceholder('Selecione o membro que deseja remover...')
                    .addOptions(memberOptions.filter(Boolean))
            );

            const response = await interaction.update({
                content: 'Selecione abaixo o usuário que você deseja remover deste ticket.',
                components: [selectMenu],
                embeds: []
            });

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.StringSelect, // Corrigido para StringSelect
                filter: i => i.user.id === interaction.user.id,
                time: 60000,
                max: 1
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                const memberIdToRemove = i.values[0];
                const memberToRemove = await interaction.guild.members.fetch(memberIdToRemove);

                await interaction.channel.permissionOverwrites.delete(memberToRemove.id);
                
                const ticketId = interaction.customId.split('_').pop();
                await logCorregedoriaEvent(ticketId, 'membro_removido', `O usuário ${memberToRemove.toString()} foi **removido** do ticket por <@${interaction.user.id}>.`, interaction.user.id);
                await updateCorregedoriaDashboard(interaction, ticketId);

                await interaction.channel.send(`✅ O acesso de ${memberToRemove.toString()} a este canal foi revogado por ${interaction.user.toString()}.`);
                await i.deleteReply();
            });

        } catch (error) {
            console.error("Erro ao remover usuário do ticket:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Ocorreu um erro ao processar a remoção.', ephemeral: true });
            } else {
                await interaction.followUp({ content: '❌ Ocorreu um erro ao processar a remoção.', ephemeral: true });
            }
        }
    }
};