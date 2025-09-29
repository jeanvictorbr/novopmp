const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db.js');

const PAGE_SIZE = 10;
let currentPage = 1;

// Mapeia o ID do usuário para a página de ranking em que ele está
const userPages = new Map();

async function generateRankingEmbed(page, interaction) {
    // A consulta agora busca o total de horas do histórico e da sessão ativa
    const rankingData = await db.all(`
        SELECT
            user_id,
            SUM(duration_seconds) AS total_seconds,
            0 as active_seconds -- Este campo será preenchido para sessões ativas
        FROM patrol_history
        GROUP BY user_id
        ORDER BY total_seconds DESC
        LIMIT 40
    `);

    // Busca as sessões ativas para somar o tempo
    const activeSessions = await db.all('SELECT user_id, start_time FROM patrol_sessions');
    const now = Math.floor(Date.now() / 1000);

    for (const active of activeSessions) {
        const userInRanking = rankingData.find(r => r.user_id === active.user_id);
        if (userInRanking) {
            userInRanking.total_seconds += (now - active.start_time);
        } else {
            // Adiciona usuários que estão em patrulha mas não no ranking
            rankingData.push({ user_id: active.user_id, total_seconds: (now - active.start_time) });
        }
    }
    
    // Ordena novamente após adicionar as sessões ativas
    rankingData.sort((a, b) => b.total_seconds - a.total_seconds);

    const totalPages = Math.ceil(rankingData.length / PAGE_SIZE);
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const paginatedData = rankingData.slice(start, end);

    const fields = await Promise.all(paginatedData.map(async (entry, index) => {
        const member = await interaction.guild.members.fetch(entry.user_id).catch(() => ({ displayName: 'Oficial Desconhecido' }));
        const totalHours = Math.floor(entry.total_seconds / 3600);
        return {
            name: `#${start + index + 1} - ${member.displayName}`,
            value: `Horas: \`${totalHours}h\``,
            inline: false,
        };
    }));

    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle('🏆 Ranking de Horas de Patrulha')
        .setDescription('Os 40 oficiais com mais horas de serviço na corporação.')
        .setFields(fields)
        .setFooter({ text: `Página ${page} de ${totalPages}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ranking_prev_1').setLabel('<<').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
        new ButtonBuilder().setCustomId('ranking_prev_page').setLabel('<').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
        new ButtonBuilder().setCustomId('ranking_next_page').setLabel('>').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages),
        new ButtonBuilder().setCustomId('ranking_next_1').setLabel('>>').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages)
    );

    return { embeds: [embed], components: [row], totalPages };
}

module.exports = {
    customId: 'ranking',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const payload = await generateRankingEmbed(1, interaction);
            await interaction.editReply(payload);
        } catch (error) {
            console.error("Erro ao gerar ranking:", error);
            await interaction.editReply('❌ Ocorreu um erro ao gerar o ranking.');
        }
    },
};