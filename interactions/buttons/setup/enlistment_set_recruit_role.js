// Local: interactions/buttons/setup/enlistment_set_recruit_role.js
const { ActionRowBuilder, RoleSelectMenuBuilder } = require('discord.js');

module.exports = {
  customId: 'enlistment_set_recruit_role',
  async execute(interaction) {
    const menu = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('enlistment_recruit_role_select')
        .setPlaceholder('Selecione o cargo para novos alistados...')
    );
    await interaction.update({ content: 'Selecione o cargo que será entregue automaticamente aos candidatos aprovados.', components: [menu] });
  },
};