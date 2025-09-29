const db = require('../../../database/db.js');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    customId: 'academy_uncertify_modal',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const courseId = interaction.fields.getTextInputValue('course_id').toUpperCase().trim();
        const userId = interaction.fields.getTextInputValue('user_id').trim();

        try {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            if (!course) {
                return await interaction.editReply('❌ Curso não encontrado. Verifique o ID do curso.');
            }

            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (!member) {
                return await interaction.editReply('❌ Oficial não encontrado no servidor. Verifique o ID do oficial.');
            }

            // Remove a certificação do banco de dados
            const result = await db.run('DELETE FROM user_certifications WHERE user_id = $1 AND course_id = $2', [member.id, courseId]);

            if (result.rowCount === 0) {
                return await interaction.editReply(`ℹ️ O oficial <@${member.id}> já não estava certificado(a) no curso **${course.name}**.`);
            }

            // Remove o cargo do oficial
            const role = interaction.guild.roles.cache.get(course.role_id);
            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role, `Certificação removida do curso: ${course.name}`);
            }

            await interaction.editReply(`✅ Certificação do curso **${course.name}** removida com sucesso para <@${member.id}>.`);

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
            console.error("Erro ao remover certificação:", error);
            await interaction.editReply('❌ Ocorreu um erro ao processar a remoção da certificação.');
        }
    },
};