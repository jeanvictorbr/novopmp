// interactions/modals/copom_start_service_modal.js (NOVO ARQUIVO)
const { EmbedBuilder } = require('discord.js');
const { openDb } = require('../../database/db.js');

module.exports = {
  customId: 'copom_start_service_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const db = await openDb();
    try {
      // Pega os dados do formulário
      const radioCode = interaction.fields.getTextInputValue('radio_code_input');
      const vehicle = interaction.fields.getTextInputValue('vehicle_input');
      const partners = interaction.fields.getTextInputValue('partners_input') || 'Nenhum';
      const startTime = Math.floor(Date.now() / 1000); // Timestamp UNIX

      // Insere a sessão no banco de dados
      await db.run(
        'INSERT INTO patrol_sessions (user_id, start_time, radio_code, vehicle, partners) VALUES (?, ?, ?, ?, ?)',
        interaction.user.id, startTime, radioCode, vehicle, partners
      );

      // Pega as configurações do DB
      const settings = await db.all('SELECT key, value FROM settings');
      const settingsMap = new Map(settings.map(s => [s.key, s.value]));
      const roleId = settingsMap.get('em_servico_role_id');
      const voiceChannelId = settingsMap.get('copom_voice_channel_id');
      const logsChannelId = settingsMap.get('copom_logs_channel_id');

      // Atribui o cargo
      if (roleId) {
        const role = await interaction.guild.roles.fetch(roleId);
        if (role) await interaction.member.roles.add(role);
      }

      // Move para o canal de voz
      if (voiceChannelId && interaction.member.voice.channel) {
        await interaction.member.voice.setChannel(voiceChannelId);
      }

      // Envia o log
      if (logsChannelId) {
        const logsChannel = await interaction.guild.channels.fetch(logsChannelId);
        const logEmbed = new EmbedBuilder()
          .setColor('Green')
          .setTitle('✅ Serviço Iniciado')
          .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
          .addFields(
            { name: 'Oficial', value: `${interaction.member}`, inline: true },
            { name: 'Código de Rádio', value: `\`${radioCode}\``, inline: true },
            { name: 'Horário', value: `<t:${startTime}:F>`, inline: false },
            { name: 'Viatura', value: `\`${vehicle}\``, inline: true },
            { name: 'Parceiros', value: partners, inline: true }
          )
          .setTimestamp();
        await logsChannel.send({ embeds: [logEmbed] });
      }

      // TODO: Atualizar o painel principal do COPOM (será implementado a seguir)

      await interaction.editReply({ content: '✅ Serviço iniciado com sucesso!', ephemeral: true });
    } catch (error) {
      console.error("Erro ao processar início de serviço:", error);
      await interaction.editReply({ content: '❌ Ocorreu um erro ao registrar seu serviço. Verifique se as configurações do bot estão corretas.', ephemeral: true });
    } finally {
      await db.close();
    }
  },
};