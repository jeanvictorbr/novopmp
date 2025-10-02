const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js');

// Função de notificação (pode ser movida para um ficheiro de utilitários)
async function sendCertificationNotification(interaction, member, course) {
    const timestamp = Math.floor(Date.now() / 1000);
    try {
        const logChannelId = (await db.get("SELECT value FROM settings WHERE key = 'academy_logs_channel_id'"))?.value;
        if (logChannelId) {
            const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder().setColor('Green').setTitle('🎖️ Nova Certificação (Direta)').setThumbnail(member.user.displayAvatarURL())
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
        const dmEmbed = new EmbedBuilder().setColor('Gold').setTitle('🎉 Parabéns! Você foi certificado!').setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
            .setDescription(`Você foi aprovado(a) e certificado(a) diretamente no curso **${course.name}**.`)
            .setThumbnail('https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmMxa2EwMjY2cWdyNHgxNXFrZmEydHlqbWk5eWJocTV2bDQ1NnVmZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/tf9jjMcO77YzV4YPwE/giphy.gif')
            .addFields(
                { name: 'Cargo Recebido', value: roleMention, inline: true },
                { name: 'Data da Certificação', value: `<t:${timestamp}:f>`, inline: true }
            ).setFooter({ text: 'Continue se dedicando e aprimorando suas habilidades.' });
        await member.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.error(`Falha ao enviar DM para ${member.user.tag}:`, error);
    }
}


const directCertifyHandler = {
    customId: (id) => id.startsWith('direct_certify_'),

    async execute(interaction) {
        const { customId } = interaction;
        
        // Etapa 1: Utilizador selecionado
        if (customId === 'direct_certify_user_select') {
            await interaction.deferUpdate();
            const targetUserId = interaction.values[0];
            const courses = await db.all('SELECT course_id, name FROM academy_courses ORDER BY name ASC');
            if (courses.length === 0) {
                return await interaction.editReply({ content: '❌ Não há cursos configurados na academia.', components: [] });
            }
            const courseOptions = courses.map(c => ({ label: c.name, value: c.course_id }));
            const courseSelectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`direct_certify_course_select_${targetUserId}`)
                    .setPlaceholder('Selecione o curso para certificar...')
                    .addOptions(courseOptions)
            );
            await interaction.editReply({ content: '**Etapa 2 de 2:** Agora, selecione o curso.', components: [courseSelectMenu] });
        }
        
        // Etapa 2: Curso selecionado, finaliza o processo
        else if (customId.startsWith('direct_certify_course_select_')) {
            await interaction.deferUpdate();
            const targetUserId = customId.split('_').pop();
            const courseId = interaction.values[0];
            const certifiedBy = interaction.user.id;
            
            const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);

            if (!member || !course) {
                return await interaction.editReply({ content: '❌ Oficial ou curso não encontrado.', components: [] });
            }

            const isCertified = await db.get('SELECT 1 FROM user_certifications WHERE user_id = $1 AND course_id = $2', [targetUserId, courseId]);
            if (isCertified) {
                return await interaction.editReply({ content: `⚠️ Este oficial já possui a certificação para **${course.name}**.`, components: [] });
            }

            await db.run('INSERT INTO user_certifications (user_id, course_id, completion_date, certified_by) VALUES ($1, $2, $3, $4)', [targetUserId, courseId, Math.floor(Date.now() / 1000), certifiedBy]);
            
            const role = interaction.guild.roles.cache.get(course.role_id);
            if (role) {
                await member.roles.add(role, `Certificado diretamente no curso: ${course.name}`);
            }

            await sendCertificationNotification(interaction, member, course);
            await interaction.editReply({ content: `✅ O oficial ${member.toString()} foi certificado com sucesso no curso **${course.name}**!`, components: [] });
        }
    }
};

module.exports = directCertifyHandler;