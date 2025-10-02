const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../database/db.js');

// Função auxiliar para formatar o progresso com emojis
const formatProgress = (current, required) => {
    const emoji = current >= required ? '✅' : '❌';
    return `${emoji} \`${current} / ${required}\``;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carreira')
        .setDescription('Verifica o seu progresso para a próxima promoção.')
        // Adiciona uma opção para administradores verificarem a carreira de outros
        .addUserOption(option =>
            option.setName('oficial')
                .setDescription('(Opcional, Staff) Veja o progresso de outro oficial.')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('oficial') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id);

        // Verifica se o utilizador que invocou o comando é um administrador se um alvo for especificado
        if (interaction.options.getUser('oficial') && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.editReply({ content: '❌ Apenas administradores podem ver a progressão de carreira de outros oficiais.', ephemeral: true });
        }
        
        try {
            // 1. Encontrar o cargo mais alto do membro
            const highestRole = member.roles.highest;

            // 2. Encontrar o requisito para a próxima promoção com base no cargo mais alto
            const nextRankRequirement = await db.get(
                'SELECT * FROM rank_requirements WHERE previous_role_id = $1',
                [highestRole.id]
            );

            if (!nextRankRequirement) {
                return await interaction.editReply(`O cargo atual de ${targetUser.username} (${highestRole.name}) não possui uma próxima etapa de carreira configurada.`);
            }

            const nextRole = await interaction.guild.roles.fetch(nextRankRequirement.role_id).catch(() => ({ name: 'Cargo Desconhecido' }));

            // 3. Buscar todos os dados de progresso do utilizador
            const now = Math.floor(Date.now() / 1000);

            // Horas de Patrulha
            const patrolHistory = await db.get('SELECT SUM(duration_seconds) AS total FROM patrol_history WHERE user_id = $1', [targetUser.id]);
            const activeSession = await db.get('SELECT start_time FROM patrol_sessions WHERE user_id = $1', [targetUser.id]);
            const activeSeconds = activeSession ? now - activeSession.start_time : 0;
            const totalSeconds = (Number(patrolHistory?.total) || 0) + activeSeconds;
            const currentHours = Math.floor(totalSeconds / 3600);

            // Cursos Concluídos
            const coursesData = await db.get('SELECT COUNT(*) AS total FROM user_certifications WHERE user_id = $1', [targetUser.id]);
            const currentCourses = coursesData?.total || 0;

            // Recrutas Aprovados
            const recruitsData = await db.get("SELECT COUNT(*) AS total FROM enlistment_requests WHERE recruiter_id = $1 AND status = 'approved'", [targetUser.id]);
            const currentRecruits = recruitsData?.total || 0;

            // Tempo no Cargo Atual
            const lastPromotion = await db.get('SELECT promoted_at FROM rank_history WHERE user_id = $1 AND role_id = $2 ORDER BY promoted_at DESC LIMIT 1', [targetUser.id, highestRole.id]);
            let currentTimeInRankDays = 0;
            if (lastPromotion) {
                currentTimeInRankDays = Math.floor((now - lastPromotion.promoted_at) / 86400);
            } else {
                 // Se não houver histórico para o cargo atual, talvez ele tenha sido atribuído manualmente. Podemos tratar isso como "tempo insuficiente" ou deixar como 0.
            }

            // 4. Montar a Embed de resposta
            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle(`📈 Progressão de Carreira - ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setDescription(`**Cargo Atual:** ${highestRole}\n**Próxima Promoção:** ${nextRole.name}`)
                .addFields(
                    { name: 'Requisitos para a Promoção', value: 'Abaixo está o seu progresso para atingir a próxima patente.' },
                    { name: '⏳ Horas de Patrulha', value: formatProgress(currentHours, nextRankRequirement.required_patrol_hours), inline: true },
                    { name: '🎓 Cursos Concluídos', value: formatProgress(currentCourses, nextRankRequirement.required_courses), inline: true },
                    { name: '👥 Recrutas Aprovados', value: formatProgress(currentRecruits, nextRankRequirement.required_recruits), inline: true },
                    { name: '🗓️ Dias no Cargo Atual', value: formatProgress(currentTimeInRankDays, nextRankRequirement.required_time_in_rank_days), inline: true }
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