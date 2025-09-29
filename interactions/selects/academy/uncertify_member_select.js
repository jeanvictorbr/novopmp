const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('uncertify_member_select_'),
    async execute(interaction) {
        await interaction.deferUpdate();
        const courseId = interaction.customId.split('_').pop();
        const userId = interaction.values[0];

        const member = await interaction.guild.members.fetch(userId);
        const course = await db.get('SELECT name FROM academy_courses WHERE course_id = $1', [courseId]);

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('⚠️ Confirmação Necessária')
            .setDescription(`Você tem certeza que deseja remover a certificação de **${member.user.username}** no curso **${course.name}**?\n\nEsta ação é irreversível e removerá o cargo associado.`);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`uncertify_confirm_${courseId}_${userId}`)
                .setLabel('Sim, remover certificação')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('uncertify_cancel')
                .setLabel('Cancelar')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [buttons] });
    }
};