const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js');

module.exports = {
    customId: 'my_status',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const userId = interaction.user.id;
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
                WHERE uc.user_id = $1
                ORDER BY uc.completion_date DESC
            `, [userId]);
            
            let coursesText = certifications.map(c => {
                const certifiedBy = c.certified_by ? `Certificado por: <@${c.certified_by}>` : 'Instrutor: `Desconhecido`';
                return `> ✅ **${c.name}**\n> Concluído em <t:${c.completion_date}:d> | ${certifiedBy}`;
            }).join('\n\n');
            if (certifications.length === 0) {
                coursesText = '`Nenhum curso concluído.`';
            }

            // --- HISTÓRICO DE CONDECORAÇÕES ---
            const decorations = await db.all(`
                SELECT m.name, m.emoji, ud.reason, ud.awarded_by, ud.awarded_at
                FROM user_decorations ud
                JOIN decorations_medals m ON ud.medal_id = m.medal_id
                WHERE ud.user_id = $1
                ORDER BY ud.awarded_at DESC
            `, [userId]);
            
            let decorationsText = decorations.map(d => `> ${d.emoji || '🏆'} **${d.name}** em <t:${d.awarded_at}:d>\n> Concedida por: <@${d.awarded_by}>`).join('\n\n') || '`Nenhuma condecoração recebida.`';


            // --- HISTÓRICO DISCIPLINAR COMPLETO ---
            const sanctions = await db.all(`
                SELECT sanction_type, reason, applied_by, applied_at
                FROM corregedoria_sanctions
                WHERE sanctioned_user_id = $1
                ORDER BY applied_at DESC
            `, [userId]);
            
            let sanctionsText = sanctions.map(s => `> **${s.sanction_type}** em <t:${s.applied_at}:d>\n> Aplicado por: <@${s.applied_by}>\n> Motivo: *${s.reason}*`).join('\n\n');
            if (sanctions.length === 0) {
                sanctionsText = '`Nenhuma sanção registrada.`';
            }

            // --- VERIFICAÇÃO DE PUNIÇÃO ATIVA ---
            const activePunishment = await db.get('SELECT s.sanction_type, ap.expires_at FROM active_punishments ap JOIN corregedoria_sanctions s ON ap.sanction_id = s.sanction_id WHERE ap.user_id = $1', [userId]);

            // --- MONTAGEM FINAL DO DOSSIÊ ---
            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle(`Dossiê de Carreira - ${interaction.user.username}`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: 'Resumo de Serviço', value: `**Patrulha:** \`${formattedTotalTime}\` | **Cursos:** \`${certifications.length}\` | **Medalhas:** \`${decorations.length}\` | **Sanções:** \`${sanctions.length}\`` },
                    { name: '🎓 Certificações da Academia', value: coursesText },
                    { name: '🏆 Condecorações e Honrarias', value: decorationsText },
                    { name: '📜 Histórico Disciplinar', value: sanctionsText }
                )
                .setTimestamp()
                .setFooter({ text: 'Phoenix • Histórico Militar' });

            if (activePunishment) {
                const expiresAtSeconds = Math.floor(new Date(activePunishment.expires_at).getTime() / 1000);
                embed.addFields({
                    name: '⚠️ Punição Ativa',
                    value: `**Tipo:** \`${activePunishment.sanction_type}\`\n**Expira:** <t:${expiresAtSeconds}:R>`
                });
                embed.setColor('Yellow');
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Erro ao gerar dossiê de status:", error);
            await interaction.editReply({ content: "Ocorreu um erro ao buscar suas informações." });
        }
    },
};