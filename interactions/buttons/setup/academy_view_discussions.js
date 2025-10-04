const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'academy_view_discussions',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const courses = await db.all("SELECT course_id, name, thread_id FROM academy_courses WHERE thread_id IS NOT NULL");

        if (courses.length === 0) {
            return await interaction.editReply({ content: 'Não há cursos com canais de discussão configurados.' });
        }

        const options = courses.map(course => ({
            label: course.name,
            description: `Acessar o tópico de discussão para o curso ${course.course_id}`,
            value: course.thread_id,
        }));

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('academy_join_discussion_select')
                .setPlaceholder('Selecione uma discussão para visualizar...')
                .addOptions(options)
        );

        await interaction.editReply({ content: 'Selecione uma discussão para ser adicionado temporariamente e visualizar o conteúdo.', components: [selectMenu] });
    }
};