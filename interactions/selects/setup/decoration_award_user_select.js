const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'decoration_award_user_select',
    async execute(interaction) {
        const targetUserId = interaction.values[0];
        const medals = await db.all('SELECT medal_id, name FROM decorations_medals ORDER BY name ASC');

        if (medals.length === 0) {
            return await interaction.update({ content: '❌ Nenhuma medalha foi criada ainda. Crie uma medalha primeiro no painel de "Gerenciar Medalhas".', components: [] });
        }

        const options = medals.map(m => ({
            label: m.name,
            value: m.medal_id.toString()
        }));

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`decoration_award_medal_select_${targetUserId}`)
                .setPlaceholder('Selecione a medalha a ser concedida...')
                .addOptions(options)
        );

        await interaction.update({ content: '**Etapa 2 de 3:** Agora, selecione a medalha.', components: [menu] });
    }
};