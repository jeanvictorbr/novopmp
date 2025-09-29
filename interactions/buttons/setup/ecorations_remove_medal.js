const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'decorations_remove_medal',
    async execute(interaction) {
        const medals = await db.all('SELECT medal_id, name FROM decorations_medals');
        if (medals.length === 0) return interaction.reply({ content: 'Não há medalhas para remover.', ephemeral: true });
        
        const options = medals.map(m => ({ label: m.name, value: m.medal_id.toString() }));
        const selectMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('decorations_remove_medal_select').setPlaceholder('Selecione a medalha para remover...').addOptions(options));
        await interaction.reply({ content: 'Selecione a medalha a ser removida. O cargo associado será excluído.', components: [selectMenu], ephemeral: true });
    }
};