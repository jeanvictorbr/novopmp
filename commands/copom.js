const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db.js');
const { updateCopomPanel } = require('../utils/updateCopomPanel.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('copom')
    .setDescription('Comandos relacionados ao COPOM.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('painel')
        .setDescription('Envia o painel de controle de serviço do COPOM no canal configurado.')
    ),
  
  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'painel') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const copomChannelId = (await db.get('SELECT value FROM settings WHERE key = $1', ['copom_channel_id']))?.value;
        if (!copomChannelId) {
          return interaction.editReply('❌ O canal do COPOM ainda não foi configurado. Use `/setup` para configurá-lo.');
        }

        const targetChannel = await interaction.guild.channels.fetch(copomChannelId).catch(() => null);
        if (!targetChannel) {
          return interaction.editReply('❌ O canal do COPOM configurado não foi encontrado.');
        }

        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle('👮 Central de Operações da Polícia (COPOM)')
          .setDescription('Controle seu status de serviço utilizando os botões abaixo.')
          .setTimestamp()
          .setFooter({ text: 'Sistema Phoenix' });

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('copom_start_service').setLabel('Iniciar Serviço').setStyle(ButtonStyle.Success).setEmoji('▶️'),
          new ButtonBuilder().setCustomId('copom_pause_service').setLabel('Pausar').setStyle(ButtonStyle.Secondary).setEmoji('⏸️'),
          new ButtonBuilder().setCustomId('copom_end_service').setLabel('Encerrar Serviço').setStyle(ButtonStyle.Danger).setEmoji('⏹️'),
        );
        
        const infoButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('my_status').setLabel('Meu Status').setStyle(ButtonStyle.Primary).setEmoji('👤'),
            new ButtonBuilder().setCustomId('ranking').setLabel('Ranking (Patrulha)').setStyle(ButtonStyle.Primary).setEmoji('🏆')
        );

        const panelMessage = await targetChannel.send({ embeds: [embed], components: [buttons, infoButtons] });
        
        await db.run('INSERT INTO panels (panel_type, channel_id, message_id) VALUES ($1, $2, $3) ON CONFLICT (panel_type) DO UPDATE SET channel_id = $2, message_id = $3',
          ['copom', panelMessage.channel.id, panelMessage.id]
        );
        
        await interaction.editReply(`✅ Painel do COPOM implantado com sucesso no canal ${targetChannel}.`);
        await updateCopomPanel(interaction.client);
      } catch (error) {
        console.error("Erro ao enviar painel do COPOM:", error);
        await interaction.editReply('❌ Ocorreu um erro ao tentar enviar o painel.');
      }
    }
  },
};