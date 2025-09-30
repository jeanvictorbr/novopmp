const { EmbedBuilder } = require('discord.js');
const { SETUP_FOOTER_TEXT, SETUP_FOOTER_ICON_URL } = require('../../views/setup_views.js'); // Importa o rodapé padrão

module.exports = {
  customId: 'recado_geral_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const messageContent = interaction.fields.getTextInputValue('recado_geral_input');
    const guild = interaction.guild;

    // Constrói a embed modelo
    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() }) // Nome e foto da guild
        .setTitle('📢 Comunicado Oficial')
        .setDescription(messageContent)
        .setTimestamp()
        .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL }); // Rodapé padrão

    await interaction.editReply('🚀 **Iniciando o envio...** Irei notificar-te quando o processo terminar.');

    let successCount = 0;
    let failCount = 0;

    // Busca todos os membros do servidor
    const members = await guild.members.fetch();

    for (const member of members.values()) {
        // Pula outros bots para não os notificar
        if (member.user.bot) continue;

        try {
            await member.send({ embeds: [embed] });
            successCount++;
        } catch (error) {
            // Se o membro tiver DMs bloqueadas, o bot ignora o erro e continua
            if (error.code === 50007) { // Código de erro para "Cannot send messages to this user"
                failCount++;
            } else {
                console.error(`Falha ao enviar DM para ${member.user.tag}:`, error);
                failCount++;
            }
        }
    }

    // Envia um relatório final para o administrador que usou o comando
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