const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder, RoleSelectMenuBuilder, PermissionsBitField } = require('discord.js'); // ADICIONADO: PermissionsBitField
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('certificar')
        .setDescription('Certifica um oficial em um curso da academia.')
        // --- LINHA ADICIONADA ---
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
        
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const courses = await db.all('SELECT * FROM academy_courses');

            if (courses.length === 0) {
                return await interaction.editReply('❌ Não há cursos configurados na academia para certificar oficiais.');
            }

            const courseOptions = courses.map(course => ({
                label: course.name,
                description: `Cargo: ${interaction.guild.roles.cache.get(course.role_id)?.name || 'Não encontrado'}`,
                value: course.course_id,
            }));

            const selectCourseMenu = new StringSelectMenuBuilder()
                .setCustomId('certify_course_select')
                .setPlaceholder('Escolha o curso para certificar o oficial...')
                .addOptions(courseOptions);

            const row = new ActionRowBuilder().addComponents(selectCourseMenu);

            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle('🎓 Certificação de Oficiais')
                .setDescription('Selecione o curso no qual você deseja certificar um oficial.');

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });
        } catch (error) {
            console.error('Erro ao iniciar o comando /certificar:', error);
            await interaction.editReply('❌ Ocorreu um erro ao iniciar o processo de certificação.');
        }
    },
};