const db = require('../../../database/db.js');

module.exports = {
  customId: 'decorations_set_promote_image_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const imageUrl = interaction.fields.getTextInputValue('promote_image_url');
        
        // Validação simples da URL
        if (!imageUrl.startsWith('http')) {
            return await interaction.editReply({ content: '❌ URL inválida. Certifique-se de que ela começa com `http` ou `https`.' });
        }

        await db.run(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
            ['decorations_promote_image_url', imageUrl]
        );
        
        await interaction.editReply({ content: '✅ Imagem de banner para anúncios de promoção foi definida com sucesso!' });

    } catch (error) {
        console.error("Erro ao salvar imagem de promoção:", error);
        await interaction.editReply({ content: '❌ Ocorreu um erro ao salvar a configuração.' });
    }
  },
};