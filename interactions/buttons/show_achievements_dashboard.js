const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db.js');

// Funções visuais para a barra de progresso
const createProgressBar = (current, required) => {
    const totalBlocks = 12;
    if (required <= 0) return `[${'🟩'.repeat(totalBlocks)}] 100%`;
    const percentage = Math.min(100, Math.floor((current / required) * 100));
    const filledBlocks = Math.round((percentage / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    let barColor = percentage >= 100 ? '🟩' : (percentage >= 50 ? '🟨' : '🟥');
    return `[${barColor.repeat(filledBlocks)}${'⬛'.repeat(emptyBlocks)}] ${percentage}%`;
};

module.exports = {
    customId: 'show_achievements_dashboard',
    async execute(interaction) {
        await interaction.deferUpdate();

        try {
            const userId = interaction.user.id;
            const now = Math.floor(Date.now() / 1000);

            // 1. Buscar todas as conquistas e as que o utilizador já desbloqueou
            const allAchievements = await db.all('SELECT * FROM achievements ORDER BY type, requirement ASC');
            const userAchievements = await db.all('SELECT * FROM user_achievements WHERE user_id = $1', [userId]);
            const unlockedMap = new Map(userAchievements.map(ua => [ua.achievement_id, ua]));

            if (allAchievements.length === 0) {
                return await interaction.editReply({ content: 'Nenhuma conquista foi configurada pela administração ainda.', embeds: [], components: [] });
            }

            // 2. Buscar o progresso atual do utilizador para cada tipo
            const patrolHistory = await db.get('SELECT SUM(duration_seconds) AS total FROM patrol_history WHERE user_id = $1', [userId]);
            const activeSession = await db.get('SELECT start_time FROM patrol_sessions WHERE user_id = $1', [userId]);
            const activeSeconds = activeSession ? now - activeSession.start_time : 0;
            const totalPatrolHours = Math.floor(((Number(patrolHistory?.total) || 0) + activeSeconds) / 3600);

            const recruitsData = await db.get("SELECT COUNT(*) AS total FROM enlistment_requests WHERE recruiter_id = $1 AND status = 'approved'", [userId]);
            const totalRecruits = recruitsData?.total || 0;

            const coursesData = await db.get('SELECT COUNT(*) AS total FROM user_certifications WHERE user_id = $1', [userId]);
            const totalCourses = coursesData?.total || 0;

            const progressMap = {
                patrol_hours: totalPatrolHours,
                recruits: totalRecruits,
                courses: totalCourses,
            };

            // 3. Construir a Embed
            const embed = new EmbedBuilder()
                .setColor('Gold')
                .setTitle(`🏅 Painel de Conquistas - ${interaction.user.username}`)
                .setDescription('Acompanhe o seu progresso para desbloquear todas as conquistas disponíveis.')
                .setThumbnail(interaction.user.displayAvatarURL())
                .setTimestamp();
            
            const achievementTypes = {
                'patrol_hours': { name: 'Horas de Patrulha', icon: '⏳' },
                'recruits': { name: 'Recrutas Aprovados', icon: '👥' },
                'courses': { name: 'Cursos Concluídos', icon: '🎓' }
            };

            // Agrupa as conquistas por tipo
            const achievementsByType = allAchievements.reduce((acc, ach) => {
                if (!acc[ach.type]) acc[ach.type] = [];
                acc[ach.type].push(ach);
                return acc;
            }, {});

            // Adiciona um campo para cada tipo de conquista
            for (const type in achievementsByType) {
                const typeInfo = achievementTypes[type] || { name: type, icon: '⭐' };
                let description = '';

                achievementsByType[type].forEach(ach => {
                    const unlockedData = unlockedMap.get(ach.achievement_id);
                    const currentProgress = progressMap[ach.type] || 0;
                    
                    if (unlockedData) {
                        description += `✅ **${ach.name}**\n*Desbloqueada em <t:${unlockedData.unlocked_at}:d>*\n\n`;
                    } else {
                        description += `🔒 **${ach.name}**\n*${ach.description}*\n`;
                        description += `Progresso: \`${currentProgress} / ${ach.requirement}\`\n${createProgressBar(currentProgress, ach.requirement)}\n\n`;
                    }
                });
                
                embed.addFields({ name: `${typeInfo.icon} ${typeInfo.name}`, value: description });
            }
            
            const backButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_dossier')
                    .setLabel('Voltar ao Dossiê')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

            await interaction.editReply({ embeds: [embed], components: [backButton] });

        } catch (error) {
            console.error("Erro ao mostrar o dashboard de conquistas:", error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao buscar as suas conquistas.', embeds: [], components: [] });
        }
    },
};