const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db.js');

// --- Funções Visuais (reutilizadas do comando /carreira) ---

const createProgressBar = (current, required) => {
    const totalBlocks = 12;
    if (required <= 0) return `[${'🟩'.repeat(totalBlocks)}] 100%`;
    const percentage = Math.min(100, Math.floor((current / required) * 100));
    const filledBlocks = Math.round((percentage / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    let barColor;
    if (percentage >= 100) barColor = '🟩';
    else if (percentage >= 50) barColor = '🟨';
    else barColor = '🟥';
    return `[${barColor.repeat(filledBlocks)}${'⬛'.repeat(emptyBlocks)}] ${percentage}%`;
};

const formatProgress = (current, required) => {
    const emoji = current >= required ? '✅' : '❌';
    const bar = createProgressBar(current, required);
    return `${emoji} \`${current} / ${required}\`\n${bar}`;
};

async function getHighestCareerRole(member) {
    const allRequirements = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
    const careerRoleIds = new Set([...allRequirements.map(r => r.role_id), ...allRequirements.map(r => r.previous_role_id)]);
    return member.roles.cache
        .filter(role => careerRoleIds.has(role.id))
        .sort((a, b) => b.position - a.position)
        .first();
}

// --- Fim das Funções Visuais ---

module.exports = {
    customId: 'show_career_progress',
    async execute(interaction) {
        await interaction.deferUpdate();

        const targetUser = interaction.user;
        const member = interaction.member;

        try {
            const highestCareerRole = await getHighestCareerRole(member);
            if (!highestCareerRole) {
                return await interaction.editReply({ content: 'O seu cargo atual não faz parte de uma progressão de carreira configurada.', embeds: [], components: [] });
            }

            const nextRankRequirement = await db.get('SELECT * FROM rank_requirements WHERE previous_role_id = $1', [highestCareerRole.id]);
            if (!nextRankRequirement) {
                return await interaction.editReply({ content: `O seu cargo atual (${highestCareerRole.name}) não possui uma próxima etapa de carreira configurada.`, embeds: [], components: [] });
            }

            const nextRole = await interaction.guild.roles.fetch(nextRankRequirement.role_id).catch(() => ({ name: 'Cargo Desconhecido' }));
            const now = Math.floor(Date.now() / 1000);

            const patrolHistory = await db.get('SELECT SUM(duration_seconds) AS total FROM patrol_history WHERE user_id = $1', [targetUser.id]);
            const activeSession = await db.get('SELECT start_time FROM patrol_sessions WHERE user_id = $1', [targetUser.id]);
            const activeSeconds = activeSession ? now - activeSession.start_time : 0;
            const totalSeconds = (Number(patrolHistory?.total) || 0) + activeSeconds;
            const currentHours = Math.floor(totalSeconds / 3600);
            const coursesData = await db.get('SELECT COUNT(*) AS total FROM user_certifications WHERE user_id = $1', [targetUser.id]);
            const currentCourses = coursesData?.total || 0;
            const recruitsData = await db.get("SELECT COUNT(*) AS total FROM enlistment_requests WHERE recruiter_id = $1 AND status = 'approved'", [targetUser.id]);
            const currentRecruits = recruitsData?.total || 0;
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
            
            // --- CORREÇÃO APLICADA AQUI ---
            const backButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_dossier') // ID alterado para um novo handler
                    .setLabel('Voltar ao Dossiê')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

            await interaction.editReply({ embeds: [embed], components: [backButton] });

        } catch (error) {
            console.error("Erro ao mostrar status de carreira:", error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao buscar as suas informações de carreira.', embeds: [], components: [] });
        }
    },
};