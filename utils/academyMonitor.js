const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const db = require('../database/db.js');
const { updateAcademyPanel } = require('./updateAcademyPanel.js');

async function cancelEnrollment(guild, course, userId, reason) {
    try {
        const member = await guild.members.fetch(userId).catch(() => null);
        await db.run('DELETE FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [userId, course.course_id]);
        if (course.thread_id && member) {
            const thread = await guild.channels.fetch(course.thread_id).catch(() => null);
            if (thread) {
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
        // --- LÓGICA DE INÍCIO DE AULA ---
        const upcomingEvents = await db.all("SELECT * FROM academy_events WHERE status = 'agendada'");
        for (const event of upcomingEvents) {
            const timeUntilStart = event.event_time - now;
            if (timeUntilStart > 0 && timeUntilStart <= 1800) { // Janela de 30 minutos
                const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [event.course_id]);
                if (!course || !course.thread_id) continue;
                const thread = await guild.channels.fetch(course.thread_id).catch(() => null);
                if (!thread || !thread.parent) {
                    console.error(`[AcademyMonitor] ERRO DE CONFIGURAÇÃO: O canal de discussão para o curso ${course.name} não foi encontrado ou não está em uma categoria.`);
                    continue;
                }

                await db.run("UPDATE academy_events SET status = 'iniciando' WHERE event_id = $1", [event.event_id]);
                
                const voiceChannel = await guild.channels.create({
                    name: `🗣️ Aula - ${course.name.substring(0, 80)}`,
                    type: ChannelType.GuildVoice,
                    parent: thread.parentId, 
                    reason: `Canal temporário para a aula ID: ${event.event_id}`
                });
                await db.run("UPDATE academy_events SET voice_channel_id = $1 WHERE event_id = $2", [voiceChannel.id, event.event_id]);
                
                const controlEmbed = new EmbedBuilder().setColor('Green').setTitle('🟢 AULA PRESTES A COMEÇAR!').setDescription(`Atenção, turma! A aula **${event.title}** começará em breve. A entrada no canal de voz é obrigatória.\n\n> **Clique aqui para entrar:** ${voiceChannel.toString()}`).addFields({ name: 'Período de Tolerância', value: 'Você tem **20 minutos** após o início da aula para entrar na chamada. Após isso, sua inscrição será cancelada.' });
                const controlButtons = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`academy_start_class_${event.event_id}`).setLabel('Iniciar Aula Agora').setStyle(ButtonStyle.Success).setEmoji('▶️'), new ButtonBuilder().setCustomId(`academy_finish_class_${event.event_id}`).setLabel('Finalizar Aula').setStyle(ButtonStyle.Danger).setEmoji('⏹️'));
                
                const enrollments = await db.all('SELECT user_id FROM academy_enrollments WHERE course_id = $1', [event.course_id]);
                const mentionString = enrollments.map(e => `<@${e.user_id}>`).join(' ');
                const controlMessage = await thread.send({ content: `Atenção, ${mentionString || '@everyone'}!`, embeds: [controlEmbed], components: [controlButtons] });
                
                await db.run("UPDATE academy_events SET control_message_id = $1 WHERE event_id = $2", [controlMessage.id, event.event_id]);
            }
        }

        // --- LÓGICA DE LEMBRETES E CONTROLE DE PRESENÇA ---
        const activeEvents = await db.all("SELECT * FROM academy_events WHERE status IN ('agendada', 'iniciando', 'em_progresso')");
        for (const event of activeEvents) {
            const timeUntilStart = event.event_time - now;
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [event.course_id]);
            if (!course) continue;

            // Lógica de Lembretes (apenas para aulas agendadas)
            if (event.status === 'agendada' && timeUntilStart > 1800 && timeUntilStart <= 7200) {
                const thread = await guild.channels.fetch(course.thread_id).catch(() => null);
                if (!thread) continue;
                const minutesUntil = Math.round(timeUntilStart / 60);
                if (minutesUntil % 30 === 0 && minutesUntil !== (event.last_reminder_sent_at || 0)) {
                    const enrollments = await db.all('SELECT user_id FROM academy_enrollments WHERE course_id = $1', [event.course_id]);
                    const mentionString = enrollments.map(e => `<@${e.user_id}>`).join(' ');
                    await thread.send(`${mentionString}\n🔔 **LEMBRETE:** A aula **${event.title}** começa em aproximadamente **${minutesUntil} minutos**!`);
                    await db.run("UPDATE academy_events SET last_reminder_sent_at = $1 WHERE event_id = $2", [minutesUntil, event.event_id]);
                }
            }

            // Lógica de Controle de Presença (apenas para aulas que já enviaram o aviso final)
            if (event.status === 'iniciando' || event.status === 'em_progresso') {
                const voiceChannel = await guild.channels.fetch(event.voice_channel_id).catch(() => null);
                if (!voiceChannel || !voiceChannel.members) continue;

                const enrollments = await db.all('SELECT * FROM academy_enrollments WHERE course_id = $1', [event.course_id]);
                if (enrollments.length === 0) continue;
                
                const membersInCallIds = new Set(voiceChannel.members.map(m => m.id));
                const timeSinceScheduledStart = now - event.event_time;

                // Se a aula está no período de tolerância e o horário de início chegou, muda o status para 'em_progresso'
                if (event.status === 'iniciando' && timeSinceScheduledStart >= 0) {
                    await db.run("UPDATE academy_events SET status = 'em_progresso' WHERE event_id = $1", [event.event_id]);
                    await updateAcademyPanel(client);
                }

                if (event.status === 'em_progresso') {
                    const thread = await guild.channels.fetch(course.thread_id).catch(() => null);
                    if (!thread) continue;
                    
                    // Lógica de tolerância de 20 minutos para quem nunca entrou
                    if (timeSinceScheduledStart > 0 && timeSinceScheduledStart <= 1200) {
                        // Não faz nada, apenas espera
                    } else if (timeSinceScheduledStart > 1200) { // Após 20 minutos
                        for (const enrollment of enrollments) {
                            if (!membersInCallIds.has(enrollment.user_id)) {
                                await cancelEnrollment(guild, course, enrollment.user_id, 'Ausência no início da aula');
                            }
                        }
                    }

                    // Lógica de tolerância de 2 minutos para quem saiu
                    for (const enrollment of enrollments) {
                        const studentId = enrollment.user_id;
                        const studentAbsence = await db.get("SELECT * FROM academy_absences WHERE event_id = $1 AND user_id = $2", [event.event_id, studentId]);
                        if (!membersInCallIds.has(studentId)) {
                            if (!studentAbsence) {
                                await db.run("INSERT INTO academy_absences (event_id, user_id, warning_sent_at) VALUES ($1, $2, $3)", [event.event_id, studentId, now]);
                                await thread.send(`⚠️ Atenção, <@${studentId}>! Você se desconectou da aula. Retorne ao canal de voz em **2 minutos** ou sua inscrição será cancelada.`);
                            } else if (now - studentAbsence.warning_sent_at >= 120) {
                                await cancelEnrollment(guild, course, studentId, 'Não retornou à chamada da aula a tempo');
                                await db.run("DELETE FROM academy_absences WHERE event_id = $1 AND user_id = $2", [event.event_id, studentId]);
                            }
                        } else if (studentAbsence) {
                            await db.run("DELETE FROM academy_absences WHERE event_id = $1 AND user_id = $2", [event.event_id, studentId]);
                            await thread.send(`✅ <@${studentId}> retornou à aula.`);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('[AcademyMonitor] Erro durante a verificação:', error);
    }
}

module.exports = { academyMonitor };