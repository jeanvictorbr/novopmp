const db = require('../../../database/db.js');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    customId: (customId) => customId.startsWith('uncertify_confirm_'),
    async execute(interaction) {
        await interaction.deferUpdate();
        const [, , courseId, userId] = interaction.customId.split('_');

        try {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            const member = await interaction.guild.members.fetch(userId).catch(() => null);

            if (!course || !member) {
                return await interaction.editReply({ content: '❌ Curso ou oficial não encontrado. A ação pode já ter sido concluída.', embeds: [], components: [] });
            }

            await db.run('DELETE FROM user_certifications WHERE user_id = $1 AND course_id = $2', [member.id, courseId]);

            const role = interaction.guild.roles.cache.get(course.role_id);
            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role, `Certificação removida por ${interaction.user.tag}`);
            }

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Sucesso!')
                .setDescription(`A certificação de **${member.user.username}** no curso **${course.name}** foi removida.`);
            
            await interaction.editReply({ embeds: [successEmbed], components: [] });

            // Envia um log da remoção
            const logChannelId = (await db.get("SELECT value FROM settings WHERE key = 'academy_logs_channel_id'"))?.value;
            if (logChannelId) {
                const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('🚫 Certificação Removida')
                        .addFields(
                            { name: 'Oficial', value: member.toString(), inline: true },
                            { name: 'Curso', value: `**${course.name}**`, inline: true },
                            { name: 'Removido por', value: interaction.user.toString(), inline: false }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }
        } catch (error) {
            console.error("Erro ao confirmar remoção de certificação:", error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao processar a remoção.', embeds: [], components: [] });
        }
    }
};