const db = require('../../../database/db.js');
const { updateAcademyPanel } = require('../../../utils/updateAcademyPanel.js');

module.exports = {
    customId: (customId) => customId.startsWith('academy_start_class_'),
    async execute(interaction) {
        await interaction.deferUpdate();
        const eventId = interaction.customId.split('_').pop();

        // Altera o status da aula no banco de dados
        await db.run("UPDATE academy_events SET status = 'em_progresso' WHERE event_id = $1", [eventId]);
        await updateAcademyPanel(interaction.client);

        await interaction.followUp({ content: '✅ A aula foi iniciada! O período de tolerância foi encerrado.', ephemeral: true });
        
        const event = await db.get('SELECT * FROM academy_events WHERE event_id = $1', [eventId]);
        const course = await db.get('SELECT * FROM academy_courses WHERE course_id = $1', [event.course_id]);
        
        if (course && course.thread_id) {
            const thread = await interaction.guild.channels.fetch(course.thread_id).catch(() => null);
            if (thread) {
                await thread.send('▶️ **O instrutor iniciou a aula!** A tolerância para ausentes foi encerrada.');
            }
        }
    },
};