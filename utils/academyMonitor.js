const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const db = require('../database/db.js');

// Função para cancelar a inscrição de um aluno ausente
async function cancelEnrollment(guild, course, event, userId, reason) {
    try {
        const member = await guild.members.fetch(userId).catch(() => null);
        
        // Remove da lista de espera
        await db.run('DELETE FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [userId, course.course_id]);
        
        // Remove do tópico de discussão
        if (course.thread_id) {
            const thread = await guild.channels.fetch(course.thread_id).catch(() => null);
            if (thread && member) {
                await thread.members.remove(userId, reason).catch(console.error);
                await thread.send(`ℹ️ O oficial ${member.toString()} foi removido da turma por ausência (${reason}).`);
            }
        }
        console.log(`[AcademyMonitor] Inscrição de ${userId} no curso ${course.course_id} cancelada por: ${reason}.`);
    } catch (error) {
        console.error(`[AcademyMonitor] Erro ao cancelar inscrição de ${userId}:`, error);
    }
}


async function academyMonitor(client) {
    const now = Math.floor(Date.now() / 1000);
    const guild = client.guilds.cache.first();
    if (!guild) return;

    try {
        // Busca por aulas agendadas que ainda não começaram
        const scheduledEvents = await db.all("SELECT * FROM academy_events WHERE status = 'agendada'");

        for (const event of scheduledEvents) {
            const timeUntilStart = event.event_time - now;
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [event.course_id]);
            if (!course || !course.thread_id) continue;

            const thread = await guild.channels.fetch(course.thread_id).catch(() => null);
            if (!thread) continue;

            // Lógica de 30 minutos antes: criar canal e enviar painel de controle
            if (timeUntilStart > 0 && timeUntilStart <= 1800) { // 30 minutos
                const voiceChannel = await guild.channels.create({
                    name: `🗣️ Aula - ${course.name.substring(0, 80)}`,
                    type: ChannelType.GuildVoice,
                    parent: thread.parent,
                    reason: `Canal temporário para a aula ID: ${event.event_id}`
                });

                const controlEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('🟢 AULA PRESTES A COMEÇAR!')
                    .setDescription(`Atenção, turma! A aula **${event.title}** começará em breve. A entrada no canal de voz é obrigatória.\n\n> **Clique aqui para entrar:** ${voiceChannel.toString()}`)
                    .addFields({ name: 'Período de Tolerância', value: 'Você tem **20 minutos** para entrar na chamada. Após isso, sua inscrição será cancelada.' });
                
                const controlButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`academy_start_class_${event.event_id}`).setLabel('Iniciar Aula Agora').setStyle(ButtonStyle.Success).setEmoji('▶️'),
                    new ButtonBuilder().setCustomId(`academy_finish_class_${event.event_id}`).setLabel('Finalizar Aula').setStyle(ButtonStyle.Danger).setEmoji('⏹️')
                );

                const controlMessage = await thread.send({ content: `@everyone`, embeds: [controlEmbed], components: [controlButtons] });

                await db.run("UPDATE academy_events SET status = 'iniciando', voice_channel_id = $1, control_message_id = $2 WHERE event_id = $3", [voiceChannel.id, controlMessage.id, event.event_id]);
                continue; // Pula para o próximo evento
            }
            
            // Lógica de lembretes (3 horas antes)
            if (timeUntilStart > 1800 && timeUntilStart <= 10800) { // Entre 30 mins e 3 horas
                const minutesUntil = Math.floor(timeUntilStart / 60);
                // Envia um lembrete a cada 30 minutos
                if (minutesUntil % 30 === 0) {
                    await thread.send(`🔔 **LEMBRETE:** A aula **${event.title}** começa em aproximadamente **${minutesUntil} minutos**!`);
                }
            }
        }

        // --- LÓGICA DE CONTROLE DE PRESENÇA ---
        const activeEvents = await db.all("SELECT * FROM academy_events WHERE status = 'iniciando' OR status = 'em_progresso'");
        for (const event of activeEvents) {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [event.course_id]);
            const voiceChannel = await guild.channels.fetch(event.voice_channel_id).catch(() => null);
            if (!course || !voiceChannel) continue;

            const enrollments = await db.all('SELECT * FROM academy_enrollments WHERE course_id = $1', [event.course_id]);
            const membersInCallIds = new Set(voiceChannel.members.map(m => m.id));
            const timeSinceStart = now - event.event_time;

            if (event.status === 'iniciando') {
                // Se passaram 20 minutos de tolerância, cancela inscrição dos ausentes
                if (timeSinceStart >= 1200) { // 20 minutos
                    for (const enrollment of enrollments) {
                        if (!membersInCallIds.has(enrollment.user_id)) {
                            await cancelEnrollment(guild, course, event, enrollment.user_id, 'Ausência no início da aula');
                        }
                    }
                    // Muda o status da aula para "em progresso"
                    await db.run("UPDATE academy_events SET status = 'em_progresso' WHERE event_id = $1", [event.event_id]);
                }
            } else if (event.status === 'em_progresso') {
                // Lógica de 2 minutos para quem saiu da call
                for (const enrollment of enrollments) {
                    if (!membersInCallIds.has(enrollment.user_id)) {
                        // (Lógica mais complexa de aviso e tempo de retorno seria adicionada aqui, similar ao patrolMonitor)
                        // Por simplicidade inicial, cancelamos direto. Podemos aprimorar depois.
                         await cancelEnrollment(guild, course, event, enrollment.user_id, 'Saiu da chamada durante a aula');
                    }
                }
            }
        }

    } catch (error) {
        console.error('[AcademyMonitor] Erro durante a verificação:', error);
    }
}

module.exports = { academyMonitor };