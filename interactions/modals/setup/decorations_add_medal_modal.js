const db = require('../../../database/db.js'); // Caminho corrigido

module.exports = {
  customId: 'decorations_add_medal_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const name = interaction.fields.getTextInputValue('medal_name');
        const description = interaction.fields.getTextInputValue('medal_description');
        const emoji = interaction.fields.getTextInputValue('medal_emoji');
        const roleName = emoji ? `${emoji} Medalha: ${name}` : `Medalha: ${name}`;

        await interaction.guild.roles.create({ name: roleName, color: 0xFFD700, reason: `Cargo para a medalha "${name}".` });
        const newRole = await db.run('INSERT INTO decorations_medals (name, description, emoji, role_id) VALUES ($1, $2, $3, $4)', [name, description, emoji, newRole.id]);

        // CORREÇÃO: Remove a tentativa de editar a mensagem anterior
        await interaction.editReply({ content: `✅ Medalha **${name}** criada com sucesso! O painel será atualizado quando você voltar.` });
    } catch (error) {
        console.error("Erro ao adicionar medalha:", error);
        await interaction.editReply({ content: '❌ Ocorreu um erro. Verifique se a medalha já existe.' });
    }
  },
};