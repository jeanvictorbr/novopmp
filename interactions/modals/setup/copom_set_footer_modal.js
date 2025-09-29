const db = require('../../../database/db.js');

module.exports = {
  customId: 'copom_set_footer_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const footerText = interaction.fields.getTextInputValue('footer_text');
    const footerIconUrl = interaction.fields.getTextInputValue('footer_icon_url');
    await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['copom_footer_text', footerText]);
    await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['copom_footer_icon_url', footerIconUrl]);
    await interaction.editReply({ content: '✅ Rodapé do módulo COPOM atualizado com sucesso!' });
  },
};