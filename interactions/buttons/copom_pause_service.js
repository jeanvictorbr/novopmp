const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { updateCopomPanel } = require('../../utils/updateCopomPanel.js');

module.exports = {
  customId: 'copom_pause_service',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const session = await db.get('SELECT * FROM patrol_sessions WHERE user_id = $1', [interaction.user.id]);
      if (!session) {
        return interaction.editReply({ content: '❌ Você não está em serviço.' });
      }

      const settings = await db.all('SELECT * FROM settings');
      const settingsMap = new Map(settings.map(s => [s.key, s.value]));
      const logsChannelId = settingsMap.get('copom_logs_channel_id');
      const footerText = settingsMap.get('copom_footer_text') || 'Sistema Phoenix';
      const footerIconUrl = settingsMap.get('copom_footer_icon_url');
      
      const logsChannel = logsChannelId ? await interaction.guild.channels.fetch(logsChannelId) : null;
      const logMessage = (logsChannel && session.log_message_id) ? await logsChannel.messages.fetch(session.log_message_id).catch(() => null) : null;

      const footerOptions = { text: footerText };
      if (footerIconUrl) footerOptions.iconURL = footerIconUrl;

      if (session.status === 'active') {
        const pauseTime = Math.floor(Date.now() / 1000);
        await db.run("UPDATE patrol_sessions SET status = 'paused', last_pause_start_time = $1 WHERE user_id = $2", [pauseTime, interaction.user.id]);
        await interaction.editReply('⏸️ Seu serviço foi pausado.');
        if (logMessage) {
            const updatedEmbed = new EmbedBuilder(logMessage.embeds[0].toJSON())
                .setColor('Yellow').addFields({ name: '⏸️ Serviço Pausado', value: `<t:${pauseTime}:T>` }).setFooter(footerOptions);
            await logMessage.edit({ embeds: [updatedEmbed] });
        }
      } else {
        const resumeTime = Math.floor(Date.now() / 1000);
        const pauseDuration = resumeTime - session.last_pause_start_time;
        await db.run("UPDATE patrol_sessions SET status = 'active', total_pause_duration = total_pause_duration + $1, last_pause_start_time = NULL WHERE user_id = $2", [pauseDuration, interaction.user.id]);
        await interaction.editReply('▶️ Seu serviço foi retomado.');
        if (logMessage) {
            const updatedEmbed = new EmbedBuilder(logMessage.embeds[0].toJSON())
                .setColor('Green').addFields({ name: '▶️ Serviço Retomado', value: `<t:${resumeTime}:T>` }).setFooter(footerOptions);
            await logMessage.edit({ embeds: [updatedEmbed] });
        }
      }
      // Adicionamos a atualização do painel aqui também.
      await updateCopomPanel(interaction.client);
    } catch (error) {
        console.error("Erro ao pausar/retomar serviço:", error);
        await interaction.editReply({ content: "Ocorreu um erro ao processar sua solicitação." });
    }
  },
};