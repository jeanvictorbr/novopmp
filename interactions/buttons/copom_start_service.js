const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const db = require('../../database/db.js');
const { updateCopomPanel } = require('../../utils/updateCopomPanel.js');

module.exports = {
  customId: 'copom_start_service',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const existingSession = await db.get('SELECT * FROM patrol_sessions WHERE user_id = $1', [interaction.user.id]);
      if (existingSession) {
        return interaction.editReply({ content: '❌ Você já está em serviço!' });
      }

      const teams = await db.all('SELECT * FROM patrol_teams');
      const settings = await db.all('SELECT * FROM settings');
      const settingsMap = new Map(settings.map(s => [s.key, s.value]));

      if (!teams || teams.length === 0) {
        return interaction.editReply({ content: '❌ Nenhuma equipe de patrulha foi configurada.' });
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Dashboard de Equipes - Iniciar Serviço')
        .setDescription('Selecione a equipe que deseja entrar. O seu nome será registrado automaticamente.');

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('team_select_menu')
        .setPlaceholder('Escolha uma equipe para entrar...');

      for (const team of teams) {
        const channel = await interaction.guild.channels.fetch(team.channel_id).catch(() => null);
        if (!channel) continue;
        const membersInChannel = channel.members;
        const isFull = membersInChannel.size >= team.max_slots;
        embed.addFields({
          name: `🚔 Equipe ${team.team_name} (${membersInChannel.size}/${team.max_slots})`,
          value: `**Canal:** ${channel}\n**Membros:**\n${membersInChannel.size > 0 ? membersInChannel.map(m => `<@${m.id}>`).join('\n') : '`Vazia`'}`,
          inline: true,
        });
        selectMenu.addOptions({
          label: `Equipe ${team.team_name}`,
          description: `Vagas: ${membersInChannel.size}/${team.max_slots}`,
          value: team.channel_id,
          emoji: isFull ? '❌' : '✅',
          disabled: isFull,
        });
      }

      const row = new ActionRowBuilder().addComponents(selectMenu);
      const message = await interaction.editReply({ embeds: [embed], components: [row], fetchReply: true });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === interaction.user.id,
        time: 60000,
      });

      collector.on('collect', async i => {
        try {
          await i.deferUpdate();
          const selectedChannelId = i.values[0];
          const teamChannel = await i.guild.channels.fetch(selectedChannelId);

          const roleId = settingsMap.get('em_servico_role_id');
          const logsChannelId = settingsMap.get('copom_logs_channel_id');
          const footerText = settingsMap.get('copom_footer_text') || 'Police Flow - By Zépiqueno';
          const footerIconUrl = settingsMap.get('copom_footer_icon_url');
          const startTime = Math.floor(Date.now() / 1000);

          if (roleId) { await i.member.roles.add(roleId).catch(console.error); }
          
          const footerOptions = { text: footerText };
          if (footerIconUrl) footerOptions.iconURL = footerIconUrl;

          const logEmbed = new EmbedBuilder()
              .setColor('Green')
              .setTitle('✅ Oficial em Serviço')
              .setThumbnail(i.user.displayAvatarURL())
              .setDescription(`${i.member} **iniciou serviço na Equipe ${teamChannel.name}.**`)
              .addFields({ name: 'Horário', value: `<t:${startTime}:F>` })
              .setTimestamp()
              .setFooter(footerOptions);
          
          let logMessageId = null;
          if (logsChannelId) {
              const logsChannel = await i.guild.channels.fetch(logsChannelId);
              const logMessage = await logsChannel.send({ embeds: [logEmbed] });
              logMessageId = logMessage.id;
          }
          
          const privateChannel = await i.guild.channels.create({
            name: `patrulha-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: i.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: i.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                },
                {
                    id: interaction.client.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                },
            ],
          });

          const dashboardButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('copom_pause_service').setLabel('Pausar').setStyle(ButtonStyle.Secondary).setEmoji('⏸️'),
              new ButtonBuilder().setCustomId('copom_end_service').setLabel('Encerrar Serviço').setStyle(ButtonStyle.Danger).setEmoji('⏹️')
          );
          
          const dashboardEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setTitle('👮 Dashboard de Patrulha')
            .setAuthor({ name: i.user.tag, iconURL: i.user.displayAvatarURL() })
            .setDescription(`**Equipe:** ${teamChannel}\n\nUse os botões para interagir com sua patrulha.`)
            .addFields({ name: 'Tempo de Serviço', value: `\`0h 0m 0s\``, inline: true })
            .setTimestamp()
            .setFooter(footerOptions);

          const personalDashboardMessage = await privateChannel.send({ embeds: [dashboardEmbed], components: [dashboardButtons] });
          
          // MENSAGEM DE MENÇÃO NO CANAL PRIVADO
          await privateChannel.send(`<@${i.user.id}>, seu serviço foi iniciado! Fique à vontade para usar este canal como sua área de trabalho.`);

          await db.run('INSERT INTO patrol_sessions (user_id, start_time, team_channel_id, log_message_id, dashboard_message_id, dashboard_channel_id, private_channel_id) VALUES ($1, $2, $3, $4, $5, $6, $7)', [i.user.id, startTime, selectedChannelId, logMessageId, personalDashboardMessage.id, privateChannel.id, privateChannel.id]);
          
          if (i.member.voice.channel) {
            await i.member.voice.setChannel(teamChannel).catch(console.error);
          } else {
            i.followUp({ content: `✅ Serviço iniciado! Seu dashboard de patrulha foi criado em ${privateChannel}.`, ephemeral: true });
          }
          
          await updateCopomPanel(i.client);

        } catch (error) {
          console.error("Erro no coletor de início de serviço:", error);
        }
      });
    } catch (error) {
        console.error("Erro ao executar Iniciar Serviço:", error);
        await interaction.editReply({ content: 'Ocorreu um erro ao preparar o dashboard de equipes.' });
    }
  },
};