const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const db = require('../database/db.js');
const { updateAcademyPanel } = require('./updateAcademyPanel.js');

// Função de cancelamento agora funcional e robusta
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
        // ... (lógica de lembretes e criação de canal permanece a mesma) ...

        const activeEvents = await db.all("SELECT * FROM academy_events WHERE status = 'iniciando' OR status = 'em_progresso'");
        for (const event of activeEvents) {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [event.course_id]);
            const voiceChannel = await guild.channels.fetch(event.voice_channel_id).catch(() => null);
            if (!course || !voiceChannel) continue;
            
            const enrollments = await db.all('SELECT * FROM academy_enrollments WHERE course_id = $1', [event.course_id]);
            if (enrollments.length === 0) continue;
            
            if (!voiceChannel.members) continue;
            const membersInCallIds = new Set(voiceChannel.members.map(m => m.id));
            const timeSinceScheduledStart = now - event.event_time;

            // Lógica do status 'iniciando' (período de tolerância de 20min)
            if (event.status === 'iniciando') {
                if (timeSinceScheduledStart >= 0) { // O horário da aula chegou
                    await db.run("UPDATE academy_events SET status = 'em_progresso' WHERE event_id = $1", [event.event_id]);
                    await updateAcademyPanel(client); // Atualiza a vitrine para "Acontecendo Agora!"
                }
                // Se a tolerância de 20min estourar, remove os ausentes
                if (timeSinceScheduledStart >= 1200) { 
                    for (const enrollment of enrollments) {
                        if (!membersInCallIds.has(enrollment.user_id)) {
                            await cancelEnrollment(guild, course, enrollment.user_id, 'Ausência no início da aula');
                        }
                    }
                }
            } 
            // Lógica do status 'em_progresso' (aula rolando)
            else if (event.status === 'em_progresso') {
                const thread = await guild.channels.fetch(course.thread_id).catch(() => null);
                if (!thread) continue;

                for (const enrollment of enrollments) {
                    const studentId = enrollment.user_id;
                    const studentAbsence = await db.get("SELECT * FROM academy_absences WHERE event_id = $1 AND user_id = $2", [event.event_id, studentId]);

                    if (!membersInCallIds.has(studentId)) { // Se o aluno NÃO está na call
                        if (!studentAbsence) { // Se não houver aviso prévio, cria um
                            await db.run("INSERT INTO academy_absences (event_id, user_id, warning_sent_at) VALUES ($1, $2, $3)", [event.event_id, studentId, now]);
                            await thread.send(`⚠️ Atenção, <@${studentId}>! Você se desconectou da aula. Retorne ao canal de voz em **2 minutos** ou sua inscrição será cancelada.`);
                        } else { // Se já houver um aviso, verifica o tempo
                            if (now - studentAbsence.warning_sent_at >= 120) { // 2 minutos
                                await cancelEnrollment(guild, course, studentId, 'Não retornou à chamada da aula a tempo');
                                await db.run("DELETE FROM academy_absences WHERE event_id = $1 AND user_id = $2", [event.event_id, studentId]);
                            }
                        }
                    } else { // Se o aluno ESTÁ na call
                        if (studentAbsence) { // Se ele tinha um aviso, significa que voltou
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