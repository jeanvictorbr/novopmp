const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verstats')
        .setDescription('[DEBUG] Vê os valores brutos das estatísticas de um oficial.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addUserOption(option => option.setName('oficial').setDescription('O oficial a ser verificado.').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const targetUser = interaction.options.getUser('oficial');

        try {
            const manualStats = await db.get('SELECT * FROM manual_stats WHERE user_id = $1', [targetUser.id]);
            const realCourses = await db.get('SELECT COUNT(*) AS total FROM user_certifications WHERE user_id = $1', [targetUser.id]);
            const realRecruits = await db.get("SELECT COUNT(*) AS total FROM enlistment_requests WHERE recruiter_id = $1 AND status = 'approved'", [targetUser.id]);

            // --- CORREÇÃO APLICADA AQUI: Conversão para Número ---
            const realCoursesCount = Number(realCourses?.total || 0);
            const manualCoursesCount = Number(manualStats?.manual_courses || 0);
            const totalCourses = realCoursesCount + manualCoursesCount;

            const realRecruitsCount = Number(realRecruits?.total || 0);
            const manualRecruitsCount = Number(manualStats?.manual_recruits || 0);
            const totalRecruits = realRecruitsCount + manualRecruitsCount;

            const embed = new EmbedBuilder()
                .setTitle(`🔍 Análise de Estatísticas: ${targetUser.username}`)
                .setColor('Yellow')
                .setDescription('Estes são os valores brutos guardados na base de dados.')
                .addFields(
                    { name: '--- Cursos Concluídos ---', value: ' ' },
                    { name: 'Cursos Reais (na tabela de certificações)', value: `\`${realCoursesCount}\``, inline: true },
                    { name: 'Cursos Manuais (adicionados com /adminstats)', value: `\`${manualCoursesCount}\``, inline: true },
                    { name: 'Soma Total', value: `\`${totalCourses}\``, inline: true },

                    { name: '--- Recrutas Aprovados ---', value: ' ' },
                    { name: 'Recrutas Reais (na tabela de alistamento)', value: `\`${realRecruitsCount}\``, inline: true },
                    { name: 'Recrutas Manuais (adicionados com /adminstats)', value: `\`${manualRecruitsCount}\``, inline: true },
                    { name: 'Soma Total', value: `\`${totalRecruits}\``, inline: true }
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Erro ao executar /verstats:', error);
            await interaction.editReply('❌ Ocorreu um erro ao buscar os dados de debug.');
        }
    },
};