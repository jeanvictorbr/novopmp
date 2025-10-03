const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db.js');

const PAGE_SIZE = 10;
const userPages = new Map();

async function generateRankingEmbed(page, interaction) {
    const rankingData = await db.all(`
        SELECT
            user_id,
            SUM(duration_seconds) AS total_seconds
        FROM patrol_history
        GROUP BY user_id
    `);

    const activeSessions = await db.all('SELECT user_id, start_time FROM patrol_sessions');
    const now = Math.floor(Date.now() / 1000);

    for (const active of activeSessions) {
        const userInRanking = rankingData.find(r => r.user_id === active.user_id);
        const activeSeconds = now - active.start_time;
        if (userInRanking) {
            userInRanking.total_seconds += activeSeconds;
        } else {
            // Adiciona usuários que só têm sessão ativa e nenhum histórico
            rankingData.push({ user_id: active.user_id, total_seconds: activeSeconds });
        }
    }

    rankingData.sort((a, b) => b.total_seconds - a.total_seconds);
    const slicedRanking = rankingData.slice(0, 40);

    const totalPages = Math.ceil(slicedRanking.length / PAGE_SIZE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    userPages.set(interaction.user.id, page);

    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const paginatedData = slicedRanking.slice(start, end);

    const fields = await Promise.all(paginatedData.map(async (entry, index) => {
        const member = await interaction.guild.members.fetch(entry.user_id).catch(() => ({ displayName: 'Oficial Desconhecido' }));

        const total_seconds = Math.floor(entry.total_seconds);
        const hours = Math.floor(total_seconds / 3600);
        const minutes = Math.floor((total_seconds % 3600) / 60);
        const seconds = total_seconds % 60;
        const formattedTime = `${hours}h ${minutes}m ${seconds}s`;
        
        return {
            name: `#${start + index + 1} - ${member.displayName}`,
            value: `Tempo Total: \`${formattedTime}\``,
            inline: false,
        };
    }));

    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle('🏆 Ranking de Horas de Patrulha')
        .setDescription('Os 40 oficiais com mais horas de serviço na corporação.')
        // --- LINHA CORRIGIDA ---
        .setFields(fields.length > 0 ? fields : { name: 'Nenhum patrulheiro no ranking', value: 'Comece a patrulhar para aparecer aqui!' })
        .setFooter({ text: `Página ${page} de ${totalPages}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ranking_prev_page').setLabel('<').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
        new ButtonBuilder().setCustomId('ranking_next_page').setLabel('>').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages)
    );

    return { embeds: [embed], components: [row] };
}

module.exports = {
    customId: (id) => id.startsWith('ranking'),
    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
        } else if (interaction.isButton()) {
            await interaction.deferUpdate();
        }

        try {
            const action = interaction.customId;
            let currentPage = userPages.get(interaction.user.id) || 1;

            if (action === 'ranking_next_page') {
                currentPage++;
            } else if (action === 'ranking_prev_page') {
                currentPage--;
            } else {
                currentPage = 1;
            }
            
            const payload = await generateRankingEmbed(currentPage, interaction);
            await interaction.editReply(payload);

        } catch (error) {
            console.error("Erro ao gerar ranking:", error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao gerar o ranking.', embeds: [], components: [] });
        }
    },
};