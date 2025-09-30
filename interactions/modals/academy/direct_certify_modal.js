const db = require('../../../database/db.js');
const { EmbedBuilder } = require('discord.js');

// Reutilizamos a função de notificação já existente
async function sendCertificationNotification(interaction, member, course) {
    // ... (cole a função sendCertificationNotification completa aqui)
}

module.exports = {
    customId: 'direct_certify_modal',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const courseId = interaction.fields.getTextInputValue('course_id').toUpperCase();
        const userId = interaction.fields.getTextInputValue('user_id');
        const certifiedBy = interaction.user.id;

        try {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            if (!course) {
                return await interaction.editReply('❌ Curso não encontrado. Verifique o ID do curso.');
            }

            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (!member) {
                return await interaction.editReply('❌ Oficial não encontrado no servidor. Verifique o ID do oficial.');
            }

            const isCertified = await db.get('SELECT 1 FROM user_certifications WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
            if (isCertified) {
                return await interaction.editReply(`⚠️ Este oficial já possui a certificação para **${course.name}**.`);
            }

            await db.run(
                'INSERT INTO user_certifications (user_id, course_id, completion_date, certified_by) VALUES ($1, $2, $3, $4)',
                [userId, courseId, Math.floor(Date.now() / 1000), certifiedBy]
            );
            
            const role = interaction.guild.roles.cache.get(course.role_id);
            if (role) {
                await member.roles.add(role, `Certificado diretamente no curso: ${course.name}`);
            }

            await sendCertificationNotification(interaction, member, course);

            await interaction.editReply(`✅ O oficial ${member.toString()} foi certificado com sucesso no curso **${course.name}**!`);
        
        } catch (error) {
            console.error("Erro na certificação direta:", error);
            await interaction.editReply('❌ Ocorreu um erro ao certificar o oficial.');
        }
    },
};

// Cole a função de notificação aqui
async function sendCertificationNotification(interaction, member, course) {
    const timestamp = Math.floor(Date.now() / 1000);
    try {
        const logChannelId = (await db.get("SELECT value FROM settings WHERE key = 'academy_logs_channel_id'"))?.value;
        if (logChannelId) {
            const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('Green').setTitle('🎖️ Nova Certificação (Direta)').setThumbnail(member.user.displayAvatarURL())
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
            .setDescription(`Você foi aprovado(a) e certificado(a) no curso **${course.name}**.`)
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