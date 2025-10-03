const { EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');

async function handleManualRoleAdd(member, addedRoles) {
    // (O conteúdo desta função permanece o mesmo, sem alterações)
    try {
        const careerRoles = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
        const careerRoleIds = new Set([...careerRoles.map(r => r.role_id), ...careerRoles.map(r => r.previous_role_id)]);
        const courseRoles = await db.all('SELECT course_id, role_id FROM academy_courses');
        const medalRoles = await db.all('SELECT medal_id, role_id FROM decorations_medals');
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
                const existingDecoration = await db.get('SELECT 1 FROM user_decorations WHERE user_id = $1 AND medal_id = $2', [member.id, medalMatch.medal_id]);
                if (!existingDecoration) {
                    await db.run('INSERT INTO user_decorations (user_id, medal_id, awarded_by, awarded_at, reason) VALUES ($1, $2, $3, $4, $5)', [member.id, medalMatch.medal_id, member.client.user.id, now, 'Atribuição manual de cargo.']);
                    console.log(`[ManualRole] Condecoração ID "${medalMatch.medal_id}" registada para ${member.user.tag}.`);
                }
            }
        }
    } catch (error) {
        console.error(`[ManualRole] Erro ao processar ADIÇÃO de cargos para ${member.user.tag}:`, error);
    }
}

async function handleManualRoleRemove(member, removedRoles) {
    try {
        const careerRoles = await db.all('SELECT role_id FROM rank_requirements UNION SELECT previous_role_id FROM rank_requirements');
        const careerRoleIds = new Set(careerRoles.map(r => r.role_id));
        const courseRoles = await db.all('SELECT course_id, role_id FROM academy_courses');
        const medalRoles = await db.all('SELECT medal_id, role_id FROM decorations_medals');
        const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;

        for (const role of removedRoles.values()) {
            if (careerRoleIds.has(role.id)) {
                await db.run('DELETE FROM rank_history WHERE user_id = $1 AND role_id = $2', [member.id, role.id]);
                console.log(`[ManualRole] Registo de promoção para "${role.name}" removido para ${member.user.tag}.`);
            }
            const courseMatch = courseRoles.find(c => c.role_id === role.id);
            if (courseMatch) {
                await db.run('DELETE FROM user_certifications WHERE user_id = $1 AND course_id = $2', [member.id, courseMatch.course_id]);
                console.log(`[ManualRole] Certificação "${courseMatch.course_id}" removida para ${member.user.tag}.`);
            }

            // --- INÍCIO DA MODIFICAÇÃO ---
            const medalMatch = medalRoles.find(m => m.role_id === role.id);
            if (medalMatch) {
                // Busca o registro específico da condecoração para obter a ID da mensagem
                const decorationRecord = await db.get(
                    'SELECT * FROM user_decorations WHERE user_id = $1 AND medal_id = $2 ORDER BY awarded_at DESC LIMIT 1', 
                    [member.id, medalMatch.medal_id]
                );

                if (decorationRecord && decorationRecord.announcement_message_id) {
                    try {
                        const announcementChannel = await member.guild.channels.fetch(decorationRecord.announcement_channel_id);
                        const announcementMessage = await announcementChannel.messages.fetch(decorationRecord.announcement_message_id);
                        
                        // Cria a nova embed de revogação
                        const originalEmbed = announcementMessage.embeds[0];
                        const revokedEmbed = new EmbedBuilder(originalEmbed.toJSON())
                            .setColor('Red')
                            .setTitle('🎖️ Condecoração Revogada 🎖️')
                            .addFields({
                                name: 'Status',
                                value: `Medalha revogada pelo Comando Superior em <t:${Math.floor(Date.now()/1000)}:d>.`
                            });
                        
                        await announcementMessage.edit({ embeds: [revokedEmbed] });

                    } catch (error) {
                        console.error(`[ManualRole] Falha ao editar anúncio de condecoração revogada:`, error);
                    }
                }

                await db.run('DELETE FROM user_decorations WHERE id = $1', [decorationRecord.id]);
                console.log(`[ManualRole] Condecoração ID "${medalMatch.medal_id}" removida para ${member.user.tag}.`);
            }
            // --- FIM DA MODIFICAÇÃO ---
            
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