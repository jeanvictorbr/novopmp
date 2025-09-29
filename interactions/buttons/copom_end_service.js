const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { updateCopomPanel } = require('../../utils/updateCopomPanel.js');

module.exports = {
  customId: 'copom_end_service',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      let session = await db.get('SELECT * FROM patrol_sessions WHERE user_id = $1', [interaction.user.id]);
      if (!session) {
        return interaction.editReply({ content: '❌ Você não está em serviço no momento.' });
      }
      
      const endTime = Math.floor(Date.now() / 1000);
      if (session.status === 'paused') {
        const lastPauseDuration = endTime - session.last_pause_start_time;
        session.total_pause_duration += lastPauseDuration;
      }
      
      const totalDurationSeconds = (endTime - session.start_time) - (session.total_pause_duration || 0);
      const hours = Math.floor(totalDurationSeconds / 3600);
      const minutes = Math.floor((totalDurationSeconds % 3600) / 60);
      const seconds = totalDurationSeconds % 60;
      const formattedDuration = `${hours}h ${minutes}m ${seconds}s`;

      // SALVANDO NO HISTÓRICO ANTES DE DELETAR A SESSÃO ATIVA
      await db.run('INSERT INTO patrol_history (user_id, start_time, end_time, duration_seconds) VALUES ($1, $2, $3, $4)', 
        [interaction.user.id, session.start_time, endTime, totalDurationSeconds]
      );
      await db.run('DELETE FROM patrol_sessions WHERE user_id = $1', [interaction.user.id]);
      
      const settings = await db.all('SELECT * FROM settings');
      const settingsMap = new Map(settings.map(s => [s.key, s.value]));
      const roleId = settingsMap.get('em_servico_role_id');
      const logsChannelId = settingsMap.get('copom_logs_channel_id');
      const footerText = settingsMap.get('copom_footer_text') || 'Police Flow - By Zépiqueno';
      const footerIconUrl = settingsMap.get('copom_footer_icon_url');
      if (roleId) {
        await interaction.member.roles.remove(roleId).catch(console.warn);
      }

      if (logsChannelId && session.log_message_id) {
        const logsChannel = await interaction.guild.channels.fetch(logsChannelId).catch(() => null);
        const logMessage = logsChannel ? await logsChannel.messages.fetch(session.log_message_id).catch(() => null) : null;
        const teamChannel = await interaction.guild.channels.fetch(session.team_channel_id).catch(() => ({ name: 'Desconhecida' }));
        if (logMessage) {
            const footerOptions = { text: footerText };
            if (footerIconUrl) footerOptions.iconURL = footerIconUrl;
            const updatedEmbed = new EmbedBuilder(logMessage.embeds[0].toJSON())
                .setColor('Red').setTitle('🔴 Oficial Fora de Serviço').setFields(
                    { name: 'Oficial', value: `${interaction.member}`, inline: false },
                    { name: 'Equipe', value: `\`${teamChannel.name}\``, inline: true },
                    { name: 'Duração Efetiva', value: `\`${formattedDuration}\``, inline: true },
                    { name: 'Início do Serviço', value: `<t:${session.start_time}:F>`, inline: false },
                    { name: 'Fim de Serviço', value: `<t:${endTime}:F>`, inline: false }
                ).setFooter(footerOptions);
            await logMessage.edit({ embeds: [updatedEmbed] });
        }
      }
      
      // Resposta inicial para o usuário
      await interaction.editReply({ content: `✅ Serviço encerrado com sucesso! Você patrulhou por **${formattedDuration}**.\n\nSeu canal de patrulha será excluído em instantes.` });
      await updateCopomPanel(interaction.client);
      
      // INÍCIO DA CONTAGEM REGRESSIVA E EXCLUSÃO DO CANAL
      if (session.private_channel_id) {
        const privateChannel = await interaction.guild.channels.fetch(session.private_channel_id).catch(() => null);
        if (privateChannel) {
            const countdownEmojis = ['🔟', '9️⃣', '8️⃣', '7️⃣', '6️⃣', '5️⃣', '4️⃣', '3️⃣', '2️⃣', '1️⃣', '💥'];
            let countdown = 10;
            const interval = setInterval(async () => {
                if (countdown >= 0) {
                    await privateChannel.send(`Excluindo canal em... ${countdownEmojis[10 - countdown]}`).catch(console.error);
                    countdown--;
                } else {
                    clearInterval(interval);
                    await privateChannel.delete('Ponto encerrado e canal removido.').catch(console.error);
                }
            }, 1000);
        }
      }

    } catch (error) {
      console.error('Erro ao encerrar serviço:', error);
      await interaction.editReply({ content: '❌ Ocorreu um erro ao tentar encerrar seu serviço.' });
    }
  },
};