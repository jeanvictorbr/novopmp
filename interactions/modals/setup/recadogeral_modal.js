const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { SETUP_FOOTER_TEXT, SETUP_FOOTER_ICON_URL } = require('../../views/setup_views.js');
const { sendingJobs } = require('../buttons/recadogeral_controls.js'); // Importa o mapa de jobs

// Função para criar/atualizar a embed do dashboard
function createDashboardEmbed(guild, job) {
    const progressBarLength = 20;
    const progress = Math.floor((job.sent + job.failed) / job.total * progressBarLength);
    const progressBar = '🟩'.repeat(progress) + '🟥'.repeat(progressBarLength - progress);

    return new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🚀 Dashboard de Envio de Recado Geral')
        .addFields(
            { name: 'Status', value: `\`${job.status.toUpperCase()}\``, inline: true },
            { name: 'Progresso', value: `\`${job.sent + job.failed} / ${job.total}\``, inline: true },
            { name: 'Último Verificado', value: job.lastChecked || '`Nenhum`' },
            { name: 'Barra de Progresso', value: progressBar },
            { name: '✅ Sucessos', value: `\`${job.sent}\``, inline: true },
            { name: '❌ Falhas (DMs Bloqueadas)', value: `\`${job.failed}\``, inline: true }
        )
        .setFooter({ text: 'O processo continua mesmo que você feche esta mensagem.' });
}

module.exports = {
  customId: 'recado_geral_modal',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const messageContent = interaction.fields.getTextInputValue('recado_geral_input');
    const guild = interaction.guild;
    const members = await guild.members.fetch();
    const memberList = Array.from(members.values()).filter(m => !m.user.bot);

    const jobId = interaction.id; // Usa o ID da interação como um ID de job único
    const job = {
        status: 'running',
        total: memberList.length,
        sent: 0,
        failed: 0,
        lastChecked: '',
        interaction: interaction // Guarda a interação para atualizações futuras
    };
    sendingJobs.set(jobId, job);

    const embed = createDashboardEmbed(guild, job);
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`recado_control_pause_${jobId}`).setLabel('Pausar').setStyle(ButtonStyle.Secondary).setEmoji('⏸️'),
        new ButtonBuilder().setCustomId(`recado_control_continue_${jobId}`).setLabel('Continuar').setStyle(ButtonStyle.Success).setEmoji('▶️'),
        new ButtonBuilder().setCustomId(`recado_control_cancel_${jobId}`).setLabel('Cancelar').setStyle(ButtonStyle.Danger).setEmoji('✖️')
    );

    await interaction.editReply({ embeds: [embed], components: [buttons] });

    // --- PROCESSO DE ENVIO ASSÍNCRONO ---
    (async () => {
        const messageEmbed = new EmbedBuilder()
            .setColor('Blue').setAuthor({ name: guild.name, iconURL: guild.iconURL() }).setTitle('📢 Comunicado Oficial')
            .setDescription(messageContent).setTimestamp().setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });

        let lastUpdate = Date.now();

        for (const member of memberList) {
            // Pausa o loop se o status mudar
            while (job.status === 'paused') {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo antes de checar de novo
            }
            // Cancela o loop
            if (job.status === 'cancelled') break;

            job.lastChecked = member.user.tag;
            try {
                await member.send({ embeds: [messageEmbed] });
                job.sent++;
            } catch (error) {
                if (error.code === 50007) {
                    job.failed++;
                }
            }
            
            // Atualiza a embed a cada 2 segundos para não sobrecarregar a API
            if (Date.now() - lastUpdate > 2000) {
                const updatedEmbed = createDashboardEmbed(guild, job);
                await interaction.editReply({ embeds: [updatedEmbed], components: [buttons] }).catch(() => {}); // Ignora erros se a interação expirar
                lastUpdate = Date.now();
            }
        }

        // Envio do relatório final
        const finalEmbed = new EmbedBuilder()
            .setTitle(job.status === 'cancelled' ? '⚠️ Envio Cancelado' : '✅ Envio Concluído')
            .setColor(job.status === 'cancelled' ? 'Orange' : 'Green')
            .addFields(
                { name: 'Membros Notificados', value: `\`${job.sent}\``, inline: true },
                { name: 'Falhas (DMs Bloqueadas)', value: `\`${job.failed}\``, inline: true },
                { name: 'Total de Membros', value: `\`${job.total}\``, inline: true }
            ).setTimestamp();
        
        await interaction.editReply({ embeds: [finalEmbed], components: [] }).catch(() => {});
        sendingJobs.delete(jobId); // Limpa o job finalizado
    })();
  },
};