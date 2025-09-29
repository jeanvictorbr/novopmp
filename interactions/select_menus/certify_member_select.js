const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('certify_member_select_'),
    async execute(interaction) {
        await interaction.deferUpdate();

        const parts = interaction.customId.split('_');
        const courseId = parts[3];
        const userId = interaction.values[0];
        
        try {
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            const member = await interaction.guild.members.fetch(userId).catch(() => null);

            if (!course || !member) {
                return await interaction.editReply('❌ Curso ou oficial não encontrado.');
            }

            await db.run('INSERT INTO user_certifications (user_id, course_id, completion_date) VALUES ($1, $2, $3)', [member.id, courseId, Math.floor(Date.now() / 1000)]);
            
            const role = interaction.guild.roles.cache.get(course.role_id);
            if (role) {
                await member.roles.add(role, `Certificado no curso: ${course.name}`);
            }

            const finalEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Certificação Concluída!')
                .setDescription(`O oficial <@${member.id}> foi certificado(a) com sucesso no curso **${course.name}**.`);

            await interaction.editReply({
                embeds: [finalEmbed],
                components: []
            });

        } catch (error) {
            console.error("Erro ao certificar oficial:", error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao certificar o oficial. Por favor, tente novamente.', embeds: [], components: [] });
        }
    },
};