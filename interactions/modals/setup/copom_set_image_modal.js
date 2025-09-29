const db = require('../../../database/db.js');

module.exports = {
  customId: 'copom_set_image_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const imageUrl = interaction.fields.getTextInputValue('image_url');
    await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['copom_panel_image_url', imageUrl]);
    await interaction.editReply({ content: '✅ Imagem principal do painel COPOM atualizada com sucesso!' });
  },
};