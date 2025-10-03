const { EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');

async function handleManualRoleAdd(member, addedRoles) {
    try {
        const careerRoles = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
        const careerRoleIds = new Set([...careerRoles.map(r => r.role_id), ...careerRoles.map(r => r.previous_role_id)]);
        const courseRoles = await db.all('SELECT course_id, role_id FROM academy_courses');
        const medalRoles = await db.all('SELECT medal_id, role_id FROM decorations_medals');

        for (const role of addedRoles.values()) {
            const now = Math.floor(Date.now() / 1000);
            
            if (careerRoleIds.has(role.id)) {
                // ... (lógica de promoção inalterada)
            }
            
            const courseMatch = courseRoles.find(c => c.role_id === role.id);
            if (courseMatch) {
                // ... (lógica de certificação inalterada)
            }
            
            // --- INÍCIO DA MODIFICAÇÃO ---
            const medalMatch = medalRoles.find(m => m.role_id === role.id);
            if (medalMatch) {
                // Procura por um registro da mesma medalha que tenha sido revogado
                const revokedRecord = await db.get(
                    "SELECT * FROM user_decorations WHERE user_id = $1 AND medal_id = $2 AND status = 'revoked' ORDER BY awarded_at DESC LIMIT 1",
                    [member.id, medalMatch.medal_id]
                );

                if (revokedRecord) {
                    // Se encontrou um registro revogado, vamos reativá-lo
                    await db.run("UPDATE user_decorations SET status = 'awarded' WHERE id = $1", [revokedRecord.id]);

                    // E reverter o anúncio original, se ele existir
                    if (revokedRecord.announcement_message_id) {
                        try {
                            const announcementChannel = await member.guild.channels.fetch(revokedRecord.announcement_channel_id);
                            const announcementMessage = await announcementChannel.messages.fetch(revokedRecord.announcement_message_id);
                            
                            // Recria a embed original
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
                    // Se não houver registro revogado, cria um novo (comportamento antigo)
                    const existingDecoration = await db.get('SELECT 1 FROM user_decorations WHERE user_id = $1 AND medal_id = $2', [member.id, medalMatch.medal_id]);
                    if (!existingDecoration) {
                        await db.run('INSERT INTO user_decorations (user_id, medal_id, awarded_by, awarded_at, reason, status) VALUES ($1, $2, $3, $4, $5, $6)', [member.id, medalMatch.medal_id, member.client.user.id, now, 'Atribuição manual de cargo.', 'awarded']);
                        console.log(`[ManualRole] Condecoração ID "${medalMatch.medal_id}" registrada para ${member.user.tag}.`);
                    }
                }
            }
            // --- FIM DA MODIFICAÇÃO ---
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
        const medalRoles = await db.all('SELECT medal_id, role_id, name, emoji FROM decorations_medals');
        const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;

        for (const role of removedRoles.values()) {
            if (careerRoleIds.has(role.id)) {
                // ... (lógica de promoção inalterada)
            }
            const courseMatch = courseRoles.find(c => c.role_id === role.id);
            if (courseMatch) {
                // ... (lógica de certificação inalterada)
            }

            // --- INÍCIO DA MODIFICAÇÃO ---
            const medalMatch = medalRoles.find(m => m.role_id === role.id);
            if (medalMatch) {
                const decorationRecord = await db.get(
                    "SELECT * FROM user_decorations WHERE user_id = $1 AND medal_id = $2 AND (status = 'awarded' OR status IS NULL) ORDER BY awarded_at DESC LIMIT 1", 
                    [member.id, medalMatch.medal_id]
                );

                if (decorationRecord) {
                    // Em vez de deletar, agora atualizamos o status para 'revoked'
                    await db.run("UPDATE user_decorations SET status = 'revoked' WHERE id = $1", [decorationRecord.id]);
                    console.log(`[ManualRole] Condecoração ID "${medalMatch.medal_id}" REVOGADA para ${member.user.tag}.`);

                    if (decorationRecord.announcement_message_id) {
                        try {
                            const announcementChannel = await member.guild.channels.fetch(decorationRecord.announcement_channel_id);
                            const announcementMessage = await announcementChannel.messages.fetch(decorationRecord.announcement_message_id);
                            
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
                }
            }
            // --- FIM DA MODIFICAÇÃO ---
            
            if (recruitRoleId && role.id === recruitRoleId) {
                // ... (lógica de alistamento inalterada)
            }
        }
    } catch (error) {
        console.error(`[ManualRole] Erro ao processar REMOÇÃO de cargos para ${member.user.tag}:`, error);
    }
}

module.exports = { handleManualRoleAdd, handleManualRoleRemove };