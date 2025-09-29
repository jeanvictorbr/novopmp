const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'academy_certify_modal',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const courseId = interaction.fields.getTextInputValue('course_id').toUpperCase().trim();
        const userId = interaction.fields.getTextInputValue('user_id').trim();

        try {
            // Verifica se o usuário que está certificando tem permissão
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return await interaction.editReply('❌ Você não tem permissão para usar esta função.');
            }

            // Busca o curso e o membro
            const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [courseId]);
            const member = await interaction.guild.members.fetch(userId).catch(() => null);

            if (!course) {
                return await interaction.editReply('❌ Curso não encontrado. Verifique o ID do curso.');
            }

            if (!member) {
                return await interaction.editReply('❌ Oficial não encontrado no servidor. Verifique o ID do oficial.');
            }

            // Remove a inscrição do oficial e adiciona a certificação
            await db.run('DELETE FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [member.id, courseId]);
            await db.run('INSERT INTO user_certifications (user_id, course_id, completion_date) VALUES ($1, $2, $3)', [member.id, courseId, Math.floor(Date.now() / 1000)]);
            
            // Adiciona o cargo ao oficial
            const role = interaction.guild.roles.cache.get(course.role_id);
            if (role) {
                await member.roles.add(role, `Certificado no curso: ${course.name}`);
            }

            // Envia a confirmação para o usuário
            await interaction.editReply(`✅ <@${member.id}> foi certificado(a) com sucesso no curso **${course.name}**!`);
        
        } catch (error) {
            console.error("Erro ao certificar oficial:", error);
            await interaction.editReply('❌ Ocorreu um erro ao certificar o oficial. Verifique se o ID do curso e do oficial estão corretos.');
        }
    },
};