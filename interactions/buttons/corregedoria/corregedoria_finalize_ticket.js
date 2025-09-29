const { EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');
const { updateCorregedoriaDashboard } = require('../../../utils/corregedoria/dashboardUpdater.js');
const { logCorregedoriaEvent } = require('../../../utils/corregedoria/eventLogger.js');

/**
 * Inicia uma contagem regressiva no canal antes de excluí-lo.
 * @param {import('discord.js').Interaction} interaction
 * @param {string} ticketId
 */
async function startCountdown(interaction, ticketId) {
    const countdownEmojis = ['🔟', '9️⃣', '8️⃣', '7️⃣', '6️⃣', '5️⃣', '4️⃣', '3️⃣', '2️⃣', '1️⃣', '💥'];
    let countdown = 10;
    const countdownMessage = await interaction.channel.send(`Este canal será excluído em... ${countdownEmojis[0]}`);

    const interval = setInterval(async () => {
        countdown--;
        if (countdown >= 0) {
            await countdownMessage.edit(`Este canal será excluído em... ${countdownEmojis[10 - countdown]}`).catch(() => {});
        }
        if (countdown < 0) {
            clearInterval(interval);
            await interaction.channel.delete(`Ticket #${ticketId} finalizado por ${interaction.user.tag}`).catch(err => console.error("Falha ao deletar canal após contagem:", err));
        }
    }, 1500); // Intervalo de 1.5 segundos para uma contagem mais suave
}

module.exports = {
    customId: (customId) => customId.startsWith('corregedoria_finalize_ticket_'),
    async execute(interaction) {
        const ticketId = interaction.customId.split('_').pop();
        
        // Cria a mensagem de confirmação
        const confirmationEmbed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('⚠️ Confirmação Final')
            .setDescription('Você tem certeza que deseja finalizar esta denúncia?\n\nO processo irá:\n1. Gerar e salvar um transcript.\n2. Notificar o denunciante.\n3. Iniciar uma contagem regressiva para **excluir o canal permanentemente**.');

        const confirmationButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`finalize_confirm_${ticketId}`).setLabel('Sim, Finalizar e Excluir').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('finalize_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );

        // Responde de forma efêmera para o corregedor
        await interaction.reply({ embeds: [confirmationEmbed], components: [confirmationButtons], ephemeral: true });

        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000, max: 1 });

        collector.on('collect', async i => {
            // Se o corregedor cancelar
            if (i.customId === 'finalize_cancel') {
                return await i.update({ content: 'Ação cancelada.', components: [], embeds: [] });
            }

            // Se o corregedor confirmar
            if (i.customId === `finalize_confirm_${ticketId}`) {
                await i.update({ content: '✅ Ação confirmada. Iniciando processo de finalização...', components: [], embeds: [] });
                
                try {
                    const ticket = await db.get('SELECT * FROM corregedoria_tickets WHERE ticket_id = $1', [ticketId]);
                    if (!ticket) return;

                    // Desabilita os botões na mensagem principal do ticket
                    await interaction.message.edit({ components: [] });

                    // 1. Gerar Transcript
                    const messages = await interaction.channel.messages.fetch({ limit: 100 });
                    const transcript = messages.reverse().map(m => `[${new Date(m.createdAt).toLocaleString('pt-BR')}] ${m.author.tag}: ${m.content}`).join('\n');
                    const transcriptFile = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: `transcript-denuncia-${ticketId}.txt` });
                    
                    // 2. Enviar Transcript para o canal dedicado e salvar a URL
                    let transcriptMessageUrl = null;
                    const transcriptChannelId = (await db.get("SELECT value FROM settings WHERE key = 'corregedoria_transcript_channel_id'"))?.value;
                    if (transcriptChannelId) {
                        const transcriptChannel = await interaction.guild.channels.fetch(transcriptChannelId).catch(() => null);
                        if (transcriptChannel) {
                             const transcriptMessage = await transcriptChannel.send({ content: `📄 Transcript para o Ticket ID: ${ticketId} (Finalizado por ${interaction.user.tag})`, files: [transcriptFile] });
                             transcriptMessageUrl = transcriptMessage.url;
                        }
                    }
                    
                    // 3. Atualizar o DB com o status, link do transcript, etc.
                    await db.run(
                        'UPDATE corregedoria_tickets SET status = $1, closed_at = $2, closed_by = $3, transcript_message_url = $4 WHERE ticket_id = $5',
                        ['finalizado', Math.floor(Date.now() / 1000), interaction.user.id, transcriptMessageUrl, ticketId]
                    );
                    
                    // 4. Registrar o evento e atualizar o dashboard de log (que agora terá o link)
                    await logCorregedoriaEvent(ticketId, 'finalizado', `O ticket foi finalizado por <@${interaction.user.id}>.`, interaction.user.id);
                    await updateCorregedoriaDashboard(interaction, ticketId);
                    
                    // 5. Enviar DM aprimorada para o denunciante
                    try {
                        const complainant = await interaction.client.users.fetch(ticket.complainant_id);
                        const dmEmbed = new EmbedBuilder()
                            .setColor('Navy')
                            .setTitle('📄 Veredito da Sua Denúncia')
                            .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                            .setThumbnail('https://i.imgur.com/sR32sQ8.png')
                            .setDescription(`Olá! A investigação referente à sua denúncia contra **${ticket.accused_info}** foi concluída pela Corregedoria.`)
                            .addFields(
                                { name: '🆔 Ticket ID', value: `\`${ticketId}\`` },
                                { name: 'Status', value: '✅ **Finalizado**' },
                                { name: 'Agradecimento', value: 'Agradecemos sua colaboração em manter a integridade e a ordem em nossa comunidade. O histórico completo foi salvo em nossos registros de auditoria.' }
                            )
                            .setTimestamp();
                        await complainant.send({ embeds: [dmEmbed] });
                    } catch (dmError) {
                        console.error(`Falha ao enviar DM para ${ticket.complainant_id}:`, dmError);
                        await interaction.channel.send(`⚠️ Não foi possível notificar o denunciante por mensagem privada.`);
                    }
                    
                    // 6. Iniciar Contagem Regressiva para exclusão
                    await startCountdown(interaction, ticketId);

                } catch (error) {
                    console.error("Erro ao finalizar ticket:", error);
                    await i.followUp({ content: '❌ Ocorreu um erro durante a finalização.', ephemeral: true });
                }
            }
        });
    }
};