const { SlashCommandBuilder, PermissionsBitField, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dessertificar')
        .setDescription('Abre o painel para remover a certificação de um oficial.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Pega todos os cursos que têm pelo menos um oficial certificado.
            const certifiedCourses = await db.all(`
                SELECT DISTINCT c.course_id, c.name
                FROM academy_courses c
                JOIN user_certifications uc ON c.course_id = uc.course_id
            `);

            if (certifiedCourses.length === 0) {
                return await interaction.editReply('ℹ️ Não há oficiais certificados em nenhum curso para remover.');
            }

            const courseOptions = certifiedCourses.map(course => ({
                label: course.name,
                description: `ID do Curso: ${course.course_id}`,
                value: course.course_id,
            }));

            const selectCourseMenu = new StringSelectMenuBuilder()
                .setCustomId('uncertify_course_select')
                .setPlaceholder('Selecione um curso...')
                .addOptions(courseOptions);

            const row = new ActionRowBuilder().addComponents(selectCourseMenu);

            const embed = new EmbedBuilder()
                .setColor('Orange')
                .setTitle('🚫 Painel de Remoção de Certificação')
                .setDescription('**Etapa 1 de 2:** Selecione o curso do qual deseja remover a certificação de um oficial.');

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error("Erro ao iniciar o painel de remoção de certificação:", error);
            await interaction.editReply('❌ Ocorreu um erro ao carregar os cursos.');
        }
    },
};