const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js');

/**
 * Registra uma ação do módulo da academia em um canal de logs.
 * @param {import('discord.js').Interaction} interaction - A interação que acionou a ação.
 * @param {string} title - O título do log (ex: "Curso Adicionado").
 * @param {string} color - A cor da embed (ex: 'Green', 'Red', 'Yellow').
 * @param {Array<{name: string, value: string, inline?: boolean}>} fields - Os campos a serem adicionados na embed.
 */
async function logAcademyAction(interaction, title, color, fields) {
    try {
        const logChannelId = (await db.get("SELECT value FROM settings WHERE key = 'academy_logs_channel_id'"))?.value;
        if (!logChannelId) return; // Se não há canal de log, não faz nada.

        const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        const logEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setTimestamp();

        // Adiciona o autor da ação como um campo padrão
        fields.unshift({ name: 'Ação realizada por', value: interaction.user.toString() });
        
        logEmbed.addFields(fields);

        await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
        console.error(`Falha ao enviar log da academia:`, error);
    }
}

module.exports = { logAcademyAction };