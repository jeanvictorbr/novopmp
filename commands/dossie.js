const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db.js');

// Esta é a mesma função de 'my_status', mas adaptada para receber um usuário alvo.
async function generateDossieEmbed(targetUser, guild) {
    const userId = targetUser.id;
    const now = Math.floor(Date.now() / 1000);

    // --- DADOS GERAIS DE PATRULHA ---
    const history = await db.all('SELECT SUM(duration_seconds) AS total_seconds FROM patrol_history WHERE user_id = $1', [userId]);
    const activeSession = await db.get('SELECT start_time FROM patrol_sessions WHERE user_id = $1', [userId]);
    const activeSeconds = activeSession ? now - activeSession.start_time : 0;
    const totalSeconds = (history[0]?.total_seconds || 0) + activeSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const formattedTotalTime = `${hours}h ${minutes}m`;

    // --- HISTÓRICO COMPLETO DA ACADEMIA ---
    const certifications = await db.all(`
        SELECT ac.name, uc.completion_date, uc.certified_by
        FROM user_certifications uc
        JOIN academy_courses ac ON uc.course_id = ac.course_id
        WHERE uc.user_id = $1 ORDER BY uc.completion_date DESC
    `, [userId]);
    let coursesText = certifications.map(c => `> ✅ **${c.name}**\n> Concluído em <t:${c.completion_date}:d> | Certificado por: <@${c.certified_by || 'Desconhecido'}>`).join('\n\n') || '`Nenhum curso concluído.`';

    // --- HISTÓRICO DISCIPLINAR COMPLETO ---
    const sanctions = await db.all(`
        SELECT sanction_id, sanction_type, reason, applied_by, applied_at
        FROM corregedoria_sanctions
        WHERE sanctioned_user_id = $1 ORDER BY applied_at DESC
    `, [userId]);
    let sanctionsText = sanctions.map(s => `> **${s.sanction_type}** (ID: ${s.sanction_id}) em <t:${s.applied_at}:d>\n> Aplicado por: <@${s.applied_by}>\n> Motivo: *${s.reason}*`).join('\n\n') || '`Nenhuma sanção registrada.`';

    // --- PUNIÇÃO ATIVA ---
    const activePunishment = await db.get('SELECT s.sanction_type, ap.expires_at FROM active_punishments ap JOIN corregedoria_sanctions s ON ap.sanction_id = s.sanction_id WHERE ap.user_id = $1', [userId]);

    // --- MONTAGEM FINAL DO DOSSIÊ ---
    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`Dossiê de Carreira - ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { name: 'Resumo de Serviço', value: `**Patrulha:** \`${formattedTotalTime}\` | **Cursos:** \`${certifications.length}\` | **Sanções:** \`${sanctions.length}\`` },
            { name: '🎓 Certificações da Academia', value: coursesText },
            { name: '📜 Histórico Disciplinar', value: sanctionsText }
        )
        .setTimestamp()
        .setFooter({ text: `Phoenix • Dossiê ID: ${userId}` });

    if (activePunishment) {
        embed.addFields({ name: '⚠️ Punição Ativa', value: `**Tipo:** \`${activePunishment.sanction_type}\`\n**Expira:** <t:${activePunishment.expires_at}:R>` });
        embed.setColor('Yellow');
    }

    return embed;
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('dossie')
        .setDescription('Consulta o histórico militar de um oficial.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => 
            option.setName('oficial')
                .setDescription('O oficial que você deseja consultar.')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const targetUser = interaction.options.getUser('oficial');
        
        try {
            const dossieEmbed = await generateDossieEmbed(targetUser, interaction.guild);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`dossie_remove_sanction_${targetUser.id}`)
                    .setLabel('Remover Sanção')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️'),
                new ButtonBuilder()
                    .setCustomId(`dossie_edit_sanction_${targetUser.id}`)
                    .setLabel('Editar Sanção')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✏️')
            );

            await interaction.editReply({ embeds: [dossieEmbed], components: [buttons] });

        } catch (error) {
            console.error("Erro ao gerar dossiê de outro usuário:", error);
            await interaction.editReply('❌ Ocorreu um erro ao buscar as informações do oficial.');
        }
    },
    generateDossieEmbed // Exporta a função para ser usada por outros arquivos
};