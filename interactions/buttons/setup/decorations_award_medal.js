const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

module.exports = {
    customId: 'decorations_award_medal',
    async execute(interaction) {
        const menu = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('decoration_award_user_select')
                .setPlaceholder('Selecione o oficial a ser condecorado...')
        );
        await interaction.reply({ content: 'Selecione o oficial que receberá a medalha.', components: [menu], ephemeral: true });
    }
};