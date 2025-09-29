const { ChannelType } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
  customId: 'copom_team_add_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const teamName = interaction.fields.getTextInputValue('team_name');
      const maxSlots = interaction.fields.getTextInputValue('max_slots') || 4;
      
      const categorySetting = await db.get('SELECT value FROM settings WHERE key = $1', ['copom_teams_category_id']);
      const categoryId = categorySetting?.value;

      if (!categoryId) {
        return interaction.editReply({ content: '❌ Ação cancelada. A categoria para equipes não está configurada.' });
      }

      // Ação principal: Criar o canal
      const newChannel = await interaction.guild.channels.create({
        name: `🚔 ${teamName}`,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        userLimit: parseInt(maxSlots),
        reason: `Equipe criada pelo sistema Phoenix a pedido de ${interaction.user.tag}`
      });

      // Ação principal: Salvar no banco de dados
      await db.run('INSERT INTO patrol_teams (channel_id, team_name, max_slots) VALUES ($1, $2, $3)', [newChannel.id, teamName, parseInt(maxSlots)]);
      
      // CORREÇÃO: Apenas damos a resposta de sucesso, sem tentar editar a mensagem anterior.
      await interaction.editReply({ content: `✅ Equipe **${teamName}** criada com sucesso!` });
      
    } catch (error) {
      console.error("Erro ao processar modal de adicionar equipe:", error);
      await interaction.editReply({ content: '❌ Falha ao criar a equipe. Verifique se tenho a permissão "Gerenciar Canais" nesta categoria.' });
    }
  },
};