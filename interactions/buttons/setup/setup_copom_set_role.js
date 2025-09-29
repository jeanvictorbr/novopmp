const { ActionRowBuilder, RoleSelectMenuBuilder } = require('discord.js');
module.exports = {
  customId: 'setup_copom_set_role',
  async execute(interaction) {
    const menu = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder().setCustomId('setup_copom_role_select').setPlaceholder('Selecione o cargo "Em Serviço"...')
    );
    await interaction.update({ components: [menu] });
  },
};