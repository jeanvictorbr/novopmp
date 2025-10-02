const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../database/db.js');

// Reutiliza a mesma função de formatação
const formatProgress = (current, required) => {
    const emoji = current >= required ? '✅' : '❌';
    return `${emoji} \`${current} / ${required}\``;
};

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

        if (!member) {
            return await interaction.editReply('❌ Oficial não encontrado no servidor.');
        }
        
        // A lógica interna é idêntica à do /carreira, mas usa 'targetUser' e 'member'
        try {
            const highestRole = member.roles.highest;
            const nextRankRequirement = await db.get('SELECT * FROM rank_requirements WHERE previous_role_id = $1', [highestRole.id]);

            if (!nextRankRequirement) {
                return await interaction.editReply(`O cargo atual de ${targetUser.username} (${highestRole.name}) não possui uma próxima etapa de carreira configurada.`);
            }

            // ... (resto da lógica de busca de progresso exatamente igual ao comando /carreira)

            // Colar a mesma lógica de busca de dados (patrulha, cursos, etc.) aqui

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
            const lastPromotion = await db.get('SELECT promoted_at FROM rank_history WHERE user_id = $1 AND role_id = $2 ORDER BY promoted_at DESC LIMIT 1', [targetUser.id, highestRole.id]);
            let currentTimeInRankDays = lastPromotion ? Math.floor((now - lastPromotion.promoted_at) / 86400) : 0;
            
            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle(`📈 Progressão de Carreira - ${targetUser.username}`)
                // ... (resto da embed exatamente igual ao comando /carreira)
                .setThumbnail(targetUser.displayAvatarURL())
                .setDescription(`**Cargo Atual:** ${highestRole}\n**Próxima Promoção:** ${nextRole.name}`)
                .addFields(
                    { name: 'Requisitos para a Promoção', value: 'Abaixo está o progresso do oficial para atingir a próxima patente.' },
                    { name: '⏳ Horas de Patrulha', value: formatProgress(currentHours, nextRankRequirement.required_patrol_hours), inline: true },
                    { name: '🎓 Cursos Concluídos', value: formatProgress(currentCourses, nextRankRequirement.required_courses), inline: true },
                    { name: '👥 Recrutas Aprovados', value: formatProgress(currentRecruits, nextRankRequirement.required_recruits), inline: true },
                    { name: '🗓️ Dias no Cargo Atual', value: formatProgress(currentTimeInRankDays, nextRankRequirement.required_time_in_rank_days), inline: true }
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