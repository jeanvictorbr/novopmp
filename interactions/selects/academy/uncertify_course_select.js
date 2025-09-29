const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: 'uncertify_course_select',
    async execute(interaction) {
        await interaction.deferUpdate();
        const courseId = interaction.values[0];

        // Busca todos os usuários certificados no curso selecionado
        const certifiedUsers = await db.all('SELECT user_id FROM user_certifications WHERE course_id = $1', [courseId]);

        if (certifiedUsers.length === 0) {
            return await interaction.editReply({ content: 'ℹ️ Não há mais oficiais certificados neste curso.', embeds: [], components: [] });
        }

        const memberOptions = await Promise.all(
            certifiedUsers.map(async (user) => {
                const member = await interaction.guild.members.fetch(user.user_id).catch(() => null);
                return member ? { label: member.user.username, description: `ID: ${member.id}`, value: member.id } : null;
            })
        );
        
        const validMemberOptions = memberOptions.filter(Boolean);

        const selectMemberMenu = new StringSelectMenuBuilder()
            .setCustomId(`uncertify_member_select_${courseId}`)
            .setPlaceholder('Selecione um oficial para remover a certificação...')
            .addOptions(validMemberOptions);

        const row = new ActionRowBuilder().addComponents(selectMemberMenu);
        const embed = new EmbedBuilder()
            .setColor('Orange')
            .setTitle('🚫 Painel de Remoção de Certificação')
            .setDescription(`**Etapa 2 de 2:** Agora, selecione o oficial para remover a certificação do curso.`);

        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};