const db = require('../../../database/db.js');
const { getCourseEnrollmentDashboardPayload } = require('../../../views/setup_views.js');
const { EmbedBuilder } = require('discord.js');

async function sendCertificationNotification(interaction, member, course) {
    const timestamp = Math.floor(Date.now() / 1000);
    try {
        const logChannelId = (await db.get("SELECT value FROM settings WHERE key = 'academy_logs_channel_id'"))?.value;
        if (logChannelId) {
            const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('🎖️ Nova Certificação')
                    .setThumbnail(member.user.displayAvatarURL())
                    .addFields(
                        { name: 'Oficial Certificado', value: member.toString(), inline: true },
                        { name: 'Curso Concluído', value: `**${course.name}**`, inline: true },
                        { name: 'Certificado por', value: interaction.user.toString(), inline: false },
                        { name: 'Data da Certificação', value: `<t:${timestamp}:F>`, inline: false }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
        }
    } catch (error) { console.error("Falha ao enviar log de certificação:", error); }

    try {
        const role = interaction.guild.roles.cache.get(course.role_id);
        const roleMention = role ? role.toString() : 'Nenhum cargo associado';
        const dmEmbed = new EmbedBuilder()
            .setColor('Gold')
            .setTitle('🎉 Parabéns! Você foi certificado!')
            .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
            .setDescription(`Você concluiu com sucesso os requisitos e foi aprovado(a) no curso **${course.name}**.`)
            .addFields(
                { name: 'Cargo Recebido', value: roleMention, inline: true },
                { name: 'Data da Certificação', value: `<t:${timestamp}:f>`, inline: true }
            )
            .setFooter({ text: 'Continue se dedicando e aprimorando suas habilidades.' });
        await member.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.error(`Falha ao enviar DM para ${member.user.tag}:`, error);
        interaction.followUp({ content: `⚠️ Não foi possível notificar ${member.toString()} por DM, mas a certificação foi concluída.`, ephemeral: true }).catch(console.error);
    }
}

module.exports = {
    customId: (customId) => customId.startsWith('academy_certify_member_select'),
    async execute(interaction) {
        await interaction.deferUpdate();
        
        const userId = interaction.values[0];
        const courseId = interaction.customId.split('_').pop();
        const certifiedBy = interaction.user.id;

        try {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            if (!course) {
                return await interaction.followUp({ content: '❌ Curso não encontrado.', ephemeral: true });
            }

            // Realiza todas as operações de banco de dados e Discord
            await db.run('DELETE FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
            await db.run('INSERT INTO user_certifications (user_id, course_id, completion_date, certified_by) VALUES ($1, $2, $3, $4)', [userId, courseId, Math.floor(Date.now() / 1000), certifiedBy]);
            
            const member = await interaction.guild.members.fetch(userId);
            const role = interaction.guild.roles.cache.get(course.role_id);
            if (member && role) {
                await member.roles.add(role, `Certificado no curso: ${course.name}`);
            }
            if (course.thread_id) {
                const thread = await interaction.guild.channels.fetch(course.thread_id).catch(() => null);
                if (thread) await thread.members.remove(userId, 'Curso concluído e certificado.').catch(console.error);
            }
            await sendCertificationNotification(interaction, member, course);
            
            // --- LÓGICA CORRIGIDA ---
            // 1. Primeiro, atualiza o painel público.
            const updatedEnrollments = await db.all('SELECT * FROM academy_enrollments WHERE course_id = $1', [courseId]);
            const updatedDashboard = await getCourseEnrollmentDashboardPayload(course, interaction.guild, updatedEnrollments);
            await interaction.message.edit(updatedDashboard);

            // 2. Apenas depois, envia a confirmação privada.
            await interaction.followUp({ content: `✅ <@${userId}> certificado(a) e notificado(a) com sucesso! O painel foi atualizado.`, ephemeral: true });

        } catch (error) {
            console.error("Erro ao certificar oficial:", error);
            // Se um erro ocorrer, o followUp é usado para a mensagem de erro.
            await interaction.followUp({ content: '❌ Ocorreu um erro ao certificar o oficial.', ephemeral: true });
        }
    },
};