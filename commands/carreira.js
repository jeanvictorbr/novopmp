const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');

const createProgressBar = (current, required) => { /* ... (código da barra de progresso) ... */ };
const formatProgress = (current, required) => { /* ... (código de formatação) ... */ };
async function getHighestCareerRole(member) { /* ... (código para encontrar o cargo) ... */ };

// Cole as 3 funções auxiliares da resposta anterior aqui

module.exports = {
    data: new SlashCommandBuilder().setName('carreira').setDescription('Verifica o seu progresso pessoal para a próxima promoção.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const targetUser = interaction.user;
        const member = interaction.member;
        
        try {
            const highestCareerRole = await getHighestCareerRole(member);
            if (!highestCareerRole) { /* ... (código de erro) ... */ }
            const nextRankRequirement = await db.get('SELECT * FROM rank_requirements WHERE previous_role_id = $1', [highestCareerRole.id]);
            if (!nextRankRequirement) { /* ... (código de erro) ... */ }

            const nextRole = await interaction.guild.roles.fetch(nextRankRequirement.role_id).catch(() => ({ name: 'Cargo Desconhecido' }));
            const now = Math.floor(Date.now() / 1000);

            // --- CORREÇÃO APLICADA AQUI ---
            const manualStats = await db.get('SELECT * FROM manual_stats WHERE user_id = $1', [targetUser.id]);
            
            const patrolHistory = await db.get('SELECT SUM(duration_seconds) AS total FROM patrol_history WHERE user_id = $1', [targetUser.id]);
            const activeSession = await db.get('SELECT start_time FROM patrol_sessions WHERE user_id = $1', [targetUser.id]);
            const activeSeconds = activeSession ? now - activeSession.start_time : 0;
            const totalSeconds = (Number(patrolHistory?.total) || 0) + activeSeconds;
            const currentHours = Math.floor(totalSeconds / 3600) + (manualStats?.manual_patrol_hours || 0);

            const coursesData = await db.get('SELECT COUNT(*) AS total FROM user_certifications WHERE user_id = $1', [targetUser.id]);
            const currentCourses = (coursesData?.total || 0) + (manualStats?.manual_courses || 0);

            const recruitsData = await db.get("SELECT COUNT(*) AS total FROM enlistment_requests WHERE recruiter_id = $1 AND status = 'approved'", [targetUser.id]);
            const currentRecruits = (recruitsData?.total || 0) + (manualStats?.manual_recruits || 0);

            const lastPromotion = await db.get('SELECT promoted_at FROM rank_history WHERE user_id = $1 AND role_id = $2 ORDER BY promoted_at DESC LIMIT 1', [targetUser.id, highestCareerRole.id]);
            let currentTimeInRankDays = lastPromotion ? Math.floor((now - lastPromotion.promoted_at) / 86400) : 0;
            
            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle(`📈 Sua Progressão de Carreira`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setDescription(`**Cargo Atual:** ${highestCareerRole}\n**Próxima Promoção:** ${nextRole.name}`)
                .addFields(
                    { name: '⏳ Horas de Patrulha', value: formatProgress(currentHours, nextRankRequirement.required_patrol_hours), inline: false },
                    { name: '🎓 Cursos Concluídos', value: formatProgress(currentCourses, nextRankRequirement.required_courses), inline: false },
                    { name: '👥 Recrutas Aprovados', value: formatProgress(currentRecruits, nextRankRequirement.required_recruits), inline: false },
                    { name: '🗓️ Dias no Cargo Atual', value: formatProgress(currentTimeInRankDays, nextRankRequirement.required_time_in_rank_days), inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Continue o bom trabalho, oficial!' });
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Erro ao executar o comando /carreira:", error);
            await interaction.editReply('❌ Ocorreu um erro ao buscar as suas informações de carreira.');
        }
    },
};