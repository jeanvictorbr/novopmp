const { EmbedBuilder } = require('discord.js');
// CORREÇÃO: O caminho foi ajustado de '../../' para '../../../'
const { SETUP_FOOTER_TEXT, SETUP_FOOTER_ICON_URL } = require('../views/setup_views.js');

module.exports = {
  customId: 'recado_geral_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const messageContent = interaction.fields.getTextInputValue('recado_geral_input');
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
        .setTitle('📢 Comunicado Oficial')
        .setDescription(messageContent)
        .setTimestamp()
        .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });

    await interaction.editReply('🚀 **Iniciando o envio...** Irei notificar-te quando o processo terminar.');

    let successCount = 0;
    let failCount = 0;
    
    const members = await guild.members.fetch();

    for (const member of members.values()) {
        if (member.user.bot) continue;
        try {
            await member.send({ embeds: [embed] });
            successCount++;
        } catch (error) {
            if (error.code === 50007) {
                failCount++;
            } else {
                console.error(`Falha ao enviar DM para ${member.user.tag}:`, error);
                failCount++;
            }
        }
    }

    const reportEmbed = new EmbedBuilder()
        .setTitle('✅ Processo de Envio Concluído')
        .setColor('Green')
        .setDescription('O envio do recado geral foi finalizado.')
        .addFields(
            { name: 'Membros Notificados com Sucesso', value: `\`${successCount}\``, inline: true },
            { name: 'Falhas (DMs bloqueadas)', value: `\`${failCount}\``, inline: true }
        )
        .setTimestamp();

    await interaction.followUp({ embeds: [reportEmbed], ephemeral: true });
  },
};