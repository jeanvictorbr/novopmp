const { EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');

async function handleManualRoleAdd(member, addedRoles) {
    try {
        const careerRoles = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
        const careerRoleIds = new Set([...careerRoles.map(r => r.role_id), ...careerRoles.map(r => r.previous_role_id)]);
        const courseRoles = await db.all('SELECT course_id, role_id FROM academy_courses');
        const medalRoles = await db.all('SELECT medal_id, role_id, name, emoji FROM decorations_medals');

        for (const role of addedRoles.values()) {
            const now = Math.floor(Date.now() / 1000);
            
            if (careerRoleIds.has(role.id)) {
                const existingPromo = await db.get('SELECT 1 FROM rank_history WHERE user_id = $1 AND role_id = $2', [member.id, role.id]);
                if (!existingPromo) {
                    await db.run('INSERT INTO rank_history (user_id, role_id, promoted_at) VALUES ($1, $2, $3)', [member.id, role.id, now]);
                    console.log(`[ManualRole] Promoção para o cargo "${role.name}" registada para ${member.user.tag}.`);
                }
            }
            
            const courseMatch = courseRoles.find(c => c.role_id === role.id);
            if (courseMatch) {
                const existingCert = await db.get('SELECT 1 FROM user_certifications WHERE user_id = $1 AND course_id = $2', [member.id, courseMatch.course_id]);
                if (!existingCert) {
                    await db.run('INSERT INTO user_certifications (user_id, course_id, completion_date, certified_by) VALUES ($1, $2, $3, $4)', [member.id, courseMatch.course_id, now, member.client.user.id]);
                    console.log(`[ManualRole] Certificação em "${courseMatch.course_id}" registada para ${member.user.tag}.`);
                }
            }
            
            const medalMatch = medalRoles.find(m => m.role_id === role.id);
            if (medalMatch) {
                const revokedRecord = await db.get(
                    "SELECT * FROM user_decorations WHERE user_id = $1 AND medal_id = $2 AND status = 'revoked' ORDER BY awarded_at DESC LIMIT 1",
                    [member.id, medalMatch.medal_id]
                );

                if (revokedRecord) {
                    await db.run("UPDATE user_decorations SET status = 'awarded' WHERE id = $1", [revokedRecord.id]);
                    if (revokedRecord.announcement_message_id) {
                        try {
                            const announcementChannel = await member.guild.channels.fetch(revokedRecord.announcement_channel_id);
                            const announcementMessage = await announcementChannel.messages.fetch(revokedRecord.announcement_message_id);
                            const originalEmbed = new EmbedBuilder()
                                .setColor('Aqua')
                                .setTitle('🏆 Condecoração por Mérito 🏆')
                                .setThumbnail(member.user.displayAvatarURL())
                                .addFields(
                                    { name: 'Oficial Condecorado', value: member.toString(), inline: false },
                                    { name: 'Medalha Recebida', value: `${medalMatch.emoji || ''} **${medalMatch.name}**`, inline: true },
                                    { name: 'Concedida Por', value: `<@${revokedRecord.awarded_by}>`, inline: true },
                                    { name: 'Justificativa', value: revokedRecord.reason }
                                )
                                .setTimestamp(new Date(revokedRecord.awarded_at * 1000))
                                .setFooter({ text: 'Comando Superior' });
                            await announcementMessage.edit({ embeds: [originalEmbed] });
                        } catch (error) {
                            console.error(`[ManualRole] Falha ao reverter anúncio de condecoração:`, error);
                        }
                    }
                    console.log(`[ManualRole] Condecoração ID "${medalMatch.medal_id}" REATIVADA para ${member.user.tag}.`);
                } else {
                    const existingDecoration = await db.get("SELECT 1 FROM user_decorations WHERE user_id = $1 AND medal_id = $2 AND (status = 'awarded' OR status IS NULL)", [member.id, medalMatch.medal_id]);
                    if (!existingDecoration) {
                        // --- CORREÇÃO APLICADA AQUI ---
                        // A query agora insere NULL explicitamente, o que é permitido após a Parte 1.
                        await db.run('INSERT INTO user_decorations (user_id, medal_id, awarded_by, awarded_at, reason, status, announcement_channel_id, announcement_message_id) VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL)', [member.id, medalMatch.medal_id, member.client.user.id, now, 'Atribuição manual de cargo.', 'awarded']);
                        console.log(`[ManualRole] Condecoração ID "${medalMatch.medal_id}" registrada para ${member.user.tag}.`);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`[ManualRole] Erro ao processar ADIÇÃO de cargos para ${member.user.tag}:`, error);
    }
}

async function handleManualRoleRemove(member, removedRoles) {
    try {
        // --- INÍCIO DA MODIFICAÇÃO ---
        // Buscamos os IDs dos cargos de carreira para poder ignorá-los
        const careerRolesResult = await db.all('SELECT role_id FROM rank_requirements UNION SELECT previous_role_id FROM rank_requirements');
        const careerRoleIds = new Set(careerRolesResult.map(r => r.role_id));
        // --- FIM DA MODIFICAÇÃO ---
        
        const courseRoles = await db.all('SELECT course_id, role_id FROM academy_courses');
        const medalRoles = await db.all('SELECT medal_id, role_id, name, emoji FROM decorations_medals');
        const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;

        for (const role of removedRoles.values()) {
            
            // --- INÍCIO DA MODIFICAÇÃO ---
            // Se o cargo removido for um cargo de carreira, a função não faz nada com o histórico.
            if (careerRoleIds.has(role.id)) {
                console.log(`[ManualRole] O cargo de carreira "${role.name}" foi removido de ${member.user.tag}, mas o histórico de promoção foi preservado.`);
                continue; // Pula para o próximo cargo na lista
            }
            // --- FIM DA MODIFICAÇÃO ---

            const courseMatch = courseRoles.find(c => c.role_id === role.id);
            if (courseMatch) {
                await db.run('DELETE FROM user_certifications WHERE user_id = $1 AND course_id = $2', [member.id, courseMatch.course_id]);
                console.log(`[ManualRole] Certificação "${courseMatch.course_id}" removida para ${member.user.tag}.`);
            }

            const medalMatch = medalRoles.find(m => m.role_id === role.id);
            if (medalMatch) {
                // ... (lógica de revogação de medalha permanece a mesma)
            }
            
            if (recruitRoleId && role.id === recruitRoleId) {
                await db.run('DELETE FROM enlistment_requests WHERE user_id = $1', [member.id]);
                console.log(`[ManualRole] Ficha de alistamento de ${member.user.tag} removida devido à remoção manual do cargo de recruta.`);
            }
        }
    } catch (error) {
        console.error(`[ManualRole] Erro ao processar REMOÇÃO de cargos para ${member.user.tag}:`, error);
    }
}

module.exports = { handleManualRoleAdd, handleManualRoleRemove };