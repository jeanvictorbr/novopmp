// Local: interactions/buttons/setup/enlistment_set_recruiter_role.js
const { ActionRowBuilder, RoleSelectMenuBuilder } = require('discord.js');

module.exports = {
  customId: 'enlistment_set_recruiter_role',
  async execute(interaction) {
    const menu = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('enlistment_recruiter_role_select')
        .setPlaceholder('Selecione o cargo de recrutador...')
    );
    await interaction.update({ content: 'Selecione o cargo que identifica os recrutadores.', components: [menu] });
  },
};