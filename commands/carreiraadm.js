const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../database/db.js');

// NOVA FUNÇÃO para criar a barra de progresso
const createProgressBar = (current, required) => {
    if (required === 0) return 'N/A';
    const percentage = Math.min(100, Math.floor((current / required) * 100));
    const filledBlocks = Math.round(percentage / 10);
    const emptyBlocks = 10 - filledBlocks;
    return `[${'█'.repeat(filledBlocks)}${'─'.repeat(emptyBlocks)}] ${percentage}%`;
};

// FUNÇÃO ATUALIZADA para formatar o progresso
const formatProgress = (current, required) => {
    const emoji = current >= required ? '✅' : '❌';
    const bar = createProgressBar(current, required);
    return `${emoji} \`${current} / ${required}\`\n${bar}`;
};

// NOVA FUNÇÃO para encontrar o cargo de carreira mais alto
async function getHighestCareerRole(member) {
    const allRequirements = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
    const careerRoleIds = new Set([...allRequirements.map(r => r.role_id), ...allRequirements.map(r => r.previous_role_id)]);
    
    return member.roles.cache
        .filter(role => careerRoleIds.has(role.id))
        .sort((a, b) => b.position - a.position)
        .first();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carreiraadm')
        .setDescription('Verifica o progresso de carreira de um oficial específico.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addUserOption(option =>
            option.setName('oficial')
                .setDescription('O oficial que deseja consultar.')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const targetUser = interaction.options.getUser('oficial');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) return await interaction.editReply('❌ Oficial não encontrado no servidor.');
        
        try {
            // LÓGICA CORRIGIDA para encontrar o cargo
            const highestCareerRole = await getHighestCareerRole(member);
            if (!highestCareerRole) {
                return await interaction.editReply(`O oficial ${targetUser.username} não possui um cargo que faça parte de uma progressão de carreira configurada.`);
            }

            const nextRankRequirement = await db.get('SELECT * FROM rank_requirements WHERE previous_role_id = $1', [highestCareerRole.id]);
            if (!nextRankRequirement) {
                return await interaction.editReply(`O cargo atual de ${targetUser.username} (${highestCareerRole.name}) não possui uma próxima etapa de carreira configurada.`);
            }

            const nextRole = await interaction.guild.roles.fetch(nextRankRequirement.role_id).catch(() => ({ name: 'Cargo Desconhecido' }));
            const now = Math.floor(Date.now() / 1000);
            
            // ... (A lógica de busca de dados permanece a mesma)
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
                .setTitle(`📈 Progressão de Carreira - ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setDescription(`**Cargo Atual:** ${highestCareerRole}\n**Próxima Promoção:** ${nextRole.name}`)
                .addFields(
                    { name: '⏳ Horas de Patrulha', value: formatProgress(currentHours, nextRankRequirement.required_patrol_hours), inline: false },
                    { name: '🎓 Cursos Concluídos', value: formatProgress(currentCourses, nextRankRequirement.required_courses), inline: false },
                    { name: '👥 Recrutas Aprovados', value: formatProgress(currentRecruits, nextRankRequirement.required_recruits), inline: false },
                    { name: '🗓️ Dias no Cargo Atual', value: formatProgress(currentTimeInRankDays, nextRankRequirement.required_time_in_rank_days), inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `Consulta realizada por: ${interaction.user.tag}` });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Erro ao executar o comando /carreiraadm:", error);
            await interaction.editReply('❌ Ocorreu um erro ao buscar as informações de carreira do oficial.');
        }
    },
};