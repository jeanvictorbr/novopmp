const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db.js');

const PAGE_SIZE = 10;
const userPages = new Map();

async function generateRecruiterRankingEmbed(page, interaction) {
    const rankingData = await db.all(`
        SELECT recruiter_id, COUNT(*) as recruit_count
        FROM enlistment_requests
        WHERE status = 'approved' AND recruiter_id IS NOT NULL
        GROUP BY recruiter_id
        ORDER BY recruit_count DESC
        LIMIT 40
    `);

    const totalPages = Math.ceil(rankingData.length / PAGE_SIZE);
    page = Math.max(1, Math.min(page, totalPages)); // Garante que a página seja válida
    userPages.set(interaction.user.id, page);

    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const paginatedData = rankingData.slice(start, end);

    const fields = await Promise.all(paginatedData.map(async (entry, index) => {
        const member = await interaction.guild.members.fetch(entry.recruiter_id).catch(() => ({ displayName: 'Recrutador Desconhecido' }));
        return {
            name: `#${start + index + 1} - ${member.displayName}`,
            value: `**Recrutamentos:** \`${entry.recruit_count}\``,
            inline: false,
        };
    }));

    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle('👥 Ranking de Recrutadores')
        .setDescription('Os 40 oficiais que mais trouxeram novos membros para a corporação.')
        .setFields(fields.length > 0 ? fields : { name: "Nenhum recrutamento", value: "Ainda não há dados de recrutamento."})
        .setFooter({ text: `Página ${page} de ${totalPages || 1}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('recruiter_ranking_prev').setLabel('<').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
        new ButtonBuilder().setCustomId('recruiter_ranking_next').setLabel('>').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages || totalPages === 0)
    );

    return { embeds: [embed], components: [row] };
}

module.exports = {
    customId: (id) => id.startsWith('recruiter_ranking'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const action = interaction.customId.split('_').pop();
            let currentPage = userPages.get(interaction.user.id) || 1;

            if (action === 'next') currentPage++;
            if (action === 'prev') currentPage--;
            
            const payload = await generateRecruiterRankingEmbed(currentPage, interaction);
            await interaction.editReply(payload);
        } catch (error) {
            console.error("Erro ao gerar ranking de recrutadores:", error);
            await interaction.editReply('❌ Ocorreu um erro ao gerar o ranking.');
        }
    },
};