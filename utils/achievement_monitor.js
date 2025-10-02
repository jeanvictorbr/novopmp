const { EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');

async function checkAndAwardAchievements(client) {
    try {
        const achievements = await db.all('SELECT * FROM achievements');
        if (achievements.length === 0) return;

        const guild = client.guilds.cache.first();
        if (!guild) return;

        const members = await guild.members.fetch();

        for (const member of members.values()) {
            if (member.user.bot) continue;

            const unlockedAchievements = await db.all('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [member.id]);
            const unlockedIds = new Set(unlockedAchievements.map(ua => ua.achievement_id));

            for (const achievement of achievements) {
                if (unlockedIds.has(achievement.achievement_id)) continue;

                let currentProgress = 0;
                const now = Math.floor(Date.now() / 1000);

                // Lógica para cada tipo de conquista
                switch (achievement.type) {
                    case 'patrol_hours':
                        const patrolHistory = await db.get('SELECT SUM(duration_seconds) AS total FROM patrol_history WHERE user_id = $1', [member.id]);
                        const activeSession = await db.get('SELECT start_time FROM patrol_sessions WHERE user_id = $1', [member.id]);
                        const activeSeconds = activeSession ? now - activeSession.start_time : 0;
                        currentProgress = Math.floor(((Number(patrolHistory?.total) || 0) + activeSeconds) / 3600);
                        break;
                    
                    case 'recruits':
                        const recruitsData = await db.get("SELECT COUNT(*) AS total FROM enlistment_requests WHERE recruiter_id = $1 AND status = 'approved'", [member.id]);
                        currentProgress = recruitsData?.total || 0;
                        break;

                    case 'courses':
                        const coursesData = await db.get('SELECT COUNT(*) AS total FROM user_certifications WHERE user_id = $1', [member.id]);
                        currentProgress = coursesData?.total || 0;
                        break;
                }

                // Verifica se o requisito foi cumprido
                if (currentProgress >= achievement.requirement) {
                    await db.run(
                        'INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES ($1, $2, $3)',
                        [member.id, achievement.achievement_id, now]
                    );

                    // Notifica o utilizador
                    try {
                        const embed = new EmbedBuilder()
                            .setColor('Gold')
                            .setTitle('🏅 Conquista Desbloqueada!')
                            .setDescription(`Parabéns, ${member.displayName}! Você desbloqueou a conquista **${achievement.name}**.\n\n*${achievement.description}*`)
                            .setThumbnail('https://i.imgur.com/g8s1t1b.png') // Um ícone genérico de medalha
                            .setTimestamp();
                        
                        await member.send({ embeds: [embed] });
                    } catch (dmError) {
                        console.warn(`[ACHIEVEMENTS] Não foi possível enviar DM para ${member.user.tag} sobre a conquista ${achievement.name}.`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('[ACHIEVEMENT_MONITOR] Erro durante a verificação de conquistas:', error);
    }
}

module.exports = { achievementMonitor: checkAndAwardAchievements };