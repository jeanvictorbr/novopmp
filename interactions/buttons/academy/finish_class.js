const db = require('../../../database/db.js');
const { updateAcademyPanel } = require('../../../utils/updateAcademyPanel.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    customId: (customId) => customId.startsWith('academy_finish_class_'),
    async execute(interaction) {
        await interaction.deferUpdate();
        const eventId = interaction.customId.split('_').pop();

        const event = await db.get('SELECT * FROM academy_events WHERE event_id = $1', [eventId]);
        if (!event) return;

        // Deleta o canal de voz temporário
        if (event.voice_channel_id) {
            const voiceChannel = await interaction.guild.channels.fetch(event.voice_channel_id).catch(() => null);
            if (voiceChannel) await voiceChannel.delete('Aula finalizada.');
        }

        // Desativa os botões na mensagem de controle
        if (event.control_message_id) {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [event.course_id]);
            const thread = await interaction.guild.channels.fetch(course.thread_id).catch(() => null);
            if (thread) {
                const controlMessage = await thread.messages.fetch(event.control_message_id).catch(() => null);
                if (controlMessage) {
                    const disabledButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('class_started').setLabel('Aula Iniciada').setStyle(ButtonStyle.Success).setDisabled(true),
                        new ButtonBuilder().setCustomId('class_finished').setLabel('Aula Finalizada').setStyle(ButtonStyle.Danger).setDisabled(true)
                    );
                    await controlMessage.edit({ components: [disabledButtons] });
                }
            }
        }
        
        // Atualiza o status no banco de dados
        await db.run("UPDATE academy_events SET status = 'finalizada' WHERE event_id = $1", [eventId]);
        await updateAcademyPanel(interaction.client);

        await interaction.followUp({ content: '✅ A aula foi finalizada e o canal de voz removido.', ephemeral: true });

        // Envia a mensagem de encerramento no tópico
        const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [event.course_id]);
        if (course && course.thread_id) {
            const thread = await interaction.guild.channels.fetch(course.thread_id).catch(() => null);
            if (thread) {
                await thread.send('⏹️ **AULA FINALIZADA!** O instrutor agora irá avaliar os participantes para a certificação. Por favor, aguardem.');
            }
        }
    },
};