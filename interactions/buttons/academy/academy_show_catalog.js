const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'academy_show_catalog',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const courses = await db.all('SELECT course_id, name, description FROM academy_courses ORDER BY name ASC');
        if (courses.length === 0) {
            return await interaction.editReply('Nenhum curso disponível no catálogo no momento.');
        }

        const options = courses.map(c => ({
            label: c.name,
            description: c.description.substring(0, 100),
            value: c.course_id
        }));

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('academy_request_course_select')
                .setPlaceholder('Selecione um curso para solicitar...')
                .addOptions(options)
        );

        await interaction.editReply({
            content: 'Selecione um curso do catálogo para entrar na lista de espera. Você será notificado quando uma turma for agendada.',
            components: [selectMenu]
        });
    }
};