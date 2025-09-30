const { EmbedBuilder } = require('discord.js');

module.exports = {
  customId: 'recado_geral_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const messageContent = interaction.fields.getTextInputValue('recado_geral_input');
    const guild = interaction.guild;

    // CORREÇÃO: Informações do rodapé definidas diretamente aqui.
    const footerText = 'PoliceFlow• Sistema de Gestão Policial 🥇';
    const footerIconURL = 'https://media.tenor.com/UHQFxxKqRGgAAAAi/police-bttv.gif';

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
        .setTitle('📢 Comunicado Oficial')
        // CORREÇÃO: Mensagem formatada em um bloco de código.
        .setDescription(`\`\`\`${messageContent}\`\`\``)
        .setTimestamp()
        .setFooter({ text: footerText, iconURL: footerIconURL });

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
            if (error.code === 50007) { // Cannot send messages to this user
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