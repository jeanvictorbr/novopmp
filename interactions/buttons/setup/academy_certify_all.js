const { getCourseEnrollmentDashboardPayload } = require('../../../views/setup_views.js');
const db = require('../../../database/db.js');
const { EmbedBuilder } = require('discord.js');

async function sendCertificationNotification(interaction, member, course) { /* ... (código inalterado) ... */ }

module.exports = {
    customId: (customId) => customId.startsWith('academy_certify_all'),
    async execute(interaction) {
        await interaction.deferUpdate();
        const courseId = interaction.customId.split('_').pop();
        const certifiedBy = interaction.user.id;
        
        try {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            if (!course) return await interaction.followUp({ content: '❌ Curso não encontrado.', ephemeral: true });
            
            const enrollments = await db.all('SELECT * FROM academy_enrollments WHERE course_id = $1', [courseId]);
            if (enrollments.length === 0) return await interaction.followUp({ content: '✅ Ninguém para certificar neste curso.', ephemeral: true });
            
            const members = await Promise.all(enrollments.map(e => interaction.guild.members.fetch(e.user_id).catch(() => null)));
            const validMembers = members.filter(Boolean);
            const role = interaction.guild.roles.cache.get(course.role_id);
            const thread = course.thread_id ? await interaction.guild.channels.fetch(course.thread_id).catch(() => null) : null;

            for (const member of validMembers) {
                await db.run('DELETE FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [member.id, courseId]);
                await db.run(
                    'INSERT INTO user_certifications (user_id, course_id, completion_date, certified_by) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, course_id) DO NOTHING', 
                    [member.id, courseId, Math.floor(Date.now() / 1000), certifiedBy]
                );
                if (role && !member.roles.cache.has(role.id)) {
                    await member.roles.add(role, `Certificado no curso: ${course.name}`).catch(console.error);
                }
                if (thread) {
                    await thread.members.remove(member.id, 'Curso concluído e certificado.').catch(console.error);
                }
                await sendCertificationNotification(interaction, member, course);
            }

            await interaction.followUp({ content: `✅ **${validMembers.length}** oficiais foram certificados e notificados. O painel foi atualizado.`, ephemeral: true });
            const updatedDashboard = await getCourseEnrollmentDashboardPayload(course, interaction.guild, []);
            await interaction.message.edit(updatedDashboard);

        } catch (error) {
            console.error("Erro ao certificar todos:", error);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao certificar os oficiais.', ephemeral: true });
        }
    },
};

// Cole a função sendCertificationNotification completa aqui, se ela estiver no mesmo arquivo.
async function sendCertificationNotification(interaction, member, course) {
    const timestamp = Math.floor(Date.now() / 1000);
    try {
        const logChannelId = (await db.get("SELECT value FROM settings WHERE key = 'academy_logs_channel_id'"))?.value;
        if (logChannelId) {
            const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('Green').setTitle('🎖️ Nova Certificação (em Massa)').setThumbnail(member.user.displayAvatarURL())
                    .addFields(
                        { name: 'Oficial Certificado', value: member.toString(), inline: true },
                        { name: 'Curso Concluído', value: `**${course.name}**`, inline: true },
                        { name: 'Certificado por', value: interaction.user.toString(), inline: false },
                        { name: 'Data da Certificação', value: `<t:${timestamp}:F>`, inline: false }
                    ).setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
        }
    } catch (error) { console.error("Falha ao enviar log de certificação:", error); }
    try {
        const role = interaction.guild.roles.cache.get(course.role_id);
        const roleMention = role ? role.toString() : 'Nenhum cargo associado';
        const dmEmbed = new EmbedBuilder()
            .setColor('Gold').setTitle('🎉 Parabéns! Você foi certificado!')
            .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
            .setDescription(`Você concluiu com sucesso os requisitos e foi aprovado(a) no curso **${course.name}**.`)
            .addFields(
                { name: 'Cargo Recebido', value: roleMention, inline: true },
                { name: 'Data da Certificação', value: `<t:${timestamp}:f>`, inline: true }
            ).setFooter({ text: 'Continue se dedicando e aprimorando suas habilidades.' });
        await member.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.error(`Falha ao enviar DM para ${member.user.tag}:`, error);
        interaction.followUp({ content: `⚠️ Não foi possível notificar ${member.toString()} por DM.`, ephemeral: true }).catch(console.error);
    }
}