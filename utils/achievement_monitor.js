const { EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');

async function checkAndAwardAchievements(client) {
    try {
        const allAchievements = await db.all('SELECT * FROM achievements');
        if (allAchievements.length === 0) return;

        const guild = client.guilds.cache.first();
        if (!guild) return;

        const members = await guild.members.fetch();

        for (const member of members.values()) {
            if (member.user.bot) continue;

            const unlockedAchievements = await db.all('SELECT * FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.achievement_id WHERE ua.user_id = $1', [member.id]);
            const unlockedIds = new Set(unlockedAchievements.map(ua => ua.achievement_id));
            const manualStats = await db.get('SELECT * FROM manual_stats WHERE user_id = $1', [member.id]);
            const now = Math.floor(Date.now() / 1000);

            const progressMap = {};

            // Função para calcular o progresso de um tipo específico, evitando recálculos
            async function getProgress(type) {
                if (progressMap[type] !== undefined) return progressMap[type];

                let currentProgress = 0;
                switch (type) {
                    case 'patrol_hours':
                        const patrolHistory = await db.get('SELECT SUM(duration_seconds) AS total FROM patrol_history WHERE user_id = $1', [member.id]);
                        const activeSession = await db.get('SELECT start_time FROM patrol_sessions WHERE user_id = $1', [member.id]);
                        const activeSeconds = activeSession ? now - activeSession.start_time : 0;
                        const realHours = Math.floor(((Number(patrolHistory?.total) || 0) + activeSeconds) / 3600);
                        currentProgress = realHours + (manualStats?.manual_patrol_hours || 0);
                        break;
                    case 'recruits':
                        const recruitsData = await db.get("SELECT COUNT(*) AS total FROM enlistment_requests WHERE recruiter_id = $1 AND status = 'approved'", [member.id]);
                        currentProgress = (recruitsData?.total || 0) + (manualStats?.manual_recruits || 0);
                        break;
                    case 'courses':
                        const coursesData = await db.get('SELECT COUNT(*) AS total FROM user_certifications WHERE user_id = $1', [member.id]);
                        currentProgress = (coursesData?.total || 0) + (manualStats?.manual_courses || 0);
                        break;
                }
                progressMap[type] = currentProgress;
                return currentProgress;
            }

            // Loop para ATRIBUIR novas conquistas
            for (const achievement of allAchievements) {
                if (unlockedIds.has(achievement.achievement_id)) continue;
                
                const currentProgress = await getProgress(achievement.type);

                if (currentProgress >= achievement.requirement) {
                    await db.run('INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES ($1, $2, $3)', [member.id, achievement.achievement_id, now]);
                    try {
                        const embed = new EmbedBuilder().setColor('Gold').setTitle('🏅 Conquista Desbloqueada!').setDescription(`Parabéns, ${member.displayName}! Você desbloqueou a conquista **${achievement.name}**.\n\n*${achievement.description}*`).setThumbnail('https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmMxa2EwMjY2cWdyNHgxNXFrZmEydHlqbWk5eWJocTV2bDQ1NnVmZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/tf9jjMcO77YzV4YPwE/giphy.gif').setTimestamp();
                        await member.send({ embeds: [embed] });
                    } catch (e) { console.warn(`[ACHIEVEMENTS] Falha ao notificar ${member.user.tag} sobre nova conquista.`); }
                }
            }

            // --- NOVA LÓGICA: Loop para REMOVER conquistas ---
            for (const unlocked of unlockedAchievements) {
                const currentProgress = await getProgress(unlocked.type);

                if (currentProgress < unlocked.requirement) {
                    await db.run('DELETE FROM user_achievements WHERE user_id = $1 AND achievement_id = $2', [member.id, unlocked.achievement_id]);
                    try {
                        const embed = new EmbedBuilder().setColor('Red').setTitle('💔 Conquista Revogada').setDescription(`A sua conquista **${unlocked.name}** foi revogada pois os requisitos não são mais cumpridos.`).setThumbnail('https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3psaGs4M3R4dXEwajh4eHZvbzVramdtbTJhb2Q5c3l3dDR6MHl0ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JT7Td5xRqkvHQvTdEu/giphy.gif').setTimestamp();
                        await member.send({ embeds: [embed] });
                    } catch (e) { console.warn(`[ACHIEVEMENTS] Falha ao notificar ${member.user.tag} sobre conquista revogada.`); }
                }
            }
        }
    } catch (error) {
        console.error('[ACHIEVEMENT_MONITOR] Erro durante a verificação de conquistas:', error);
    }
}

module.exports = { achievementMonitor: checkAndAwardAchievements };