const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
module.exports = {
    customId: 'decorations_promote_officer',
    async execute(interaction) {
        const menu = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder().setCustomId('promote_select_user').setPlaceholder('Selecione o oficial a ser promovido...')
        );
        await interaction.reply({ content: '**Etapa 1 de 3:** Selecione o oficial.', components: [menu], ephemeral: true });
    }
};