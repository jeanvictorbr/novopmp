const { EmbedBuilder } = require('discord.js');
// ALTERAÇÃO: Importamos o objeto 'db' em vez da função 'openDb'.
const db = require('../database/db.js');

async function updateCopomPanel(client) {
  // ALTERAÇÃO: Não usamos mais openDb() nem closeDb().
  try {
    const panelInfo = await db.get('SELECT * FROM panels WHERE panel_type = $1', ['copom']);
    if (!panelInfo) return;

    const settings = await db.all('SELECT * FROM settings');
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));
    const imageUrl = settingsMap.get('copom_panel_image_url');
    const footerText = settingsMap.get('copom_footer_text') || 'Police Flow - By Zépiqueno';
    const footerIconUrl = settingsMap.get('copom_footer_icon_url');

    const activeSessions = await db.all('SELECT * FROM patrol_sessions');
    const definedTeams = await db.all('SELECT * FROM patrol_teams');

    const channel = await client.channels.fetch(panelInfo.channel_id).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(panelInfo.message_id).catch(() => null);
    if (!message) return;

    const footerOptions = { text: footerText };
    if (footerIconUrl) footerOptions.iconURL = footerIconUrl;

    const updatedEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('👮 Central de Operações da Polícia (COPOM)')
      .setDescription(`Total de policiais em serviço: **${activeSessions.length}**`)
      .setTimestamp()
      .setFooter(footerOptions);

    if (imageUrl) updatedEmbed.setImage(imageUrl);

    if (definedTeams.length === 0) {
      updatedEmbed.addFields({ name: 'Equipes', value: 'Nenhuma equipe configurada.' });
    } else {
      for (const team of definedTeams) {
        const membersInTeam = activeSessions.filter(s => s.team_channel_id === team.channel_id);
        let memberList = '`Vazia`';
        if (membersInTeam.length > 0) {
          memberList = membersInTeam.map(member => `<@${member.user_id}>`).join('\n');
        }
        updatedEmbed.addFields({
          name: `🚔 Equipe ${team.team_name} (${membersInTeam.length}/${team.max_slots})`,
          value: memberList,
          inline: true,
        });
      }
    }
    
    await message.edit({ embeds: [updatedEmbed] });

  } catch (error) {
    console.error("Falha ao atualizar o painel do COPOM:", error);
  }
}

module.exports = { updateCopomPanel };