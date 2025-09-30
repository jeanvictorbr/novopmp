const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../database/db.js');

const PAGE_SIZE = 10;

async function generateRecruiterRankingEmbed(page, interaction) {
    const offset = (page - 1) * PAGE_SIZE;
    const rankingData = await db.all(`
        SELECT recruiter_id, COUNT(*) as recruit_count
        FROM enlistment_requests
        WHERE status = 'approved' AND recruiter_id IS NOT NULL
        GROUP BY recruiter_id
        ORDER BY recruit_count DESC
        LIMIT $1 OFFSET $2
    `, [PAGE_SIZE, offset]);

    const total = await db.get("SELECT COUNT(DISTINCT recruiter_id) as total FROM enlistment_requests WHERE status = 'approved' AND recruiter_id IS NOT NULL");
    const totalPages = Math.ceil((total?.total || 0) / PAGE_SIZE);

    const fields = await Promise.all(rankingData.map(async (entry, index) => {
        const member = await interaction.guild.members.fetch(entry.recruiter_id).catch(() => null);
        const displayName = member ? member.displayName : 'Recrutador Desconhecido';
        return {
            name: `#${offset + index + 1} - ${displayName}`,
            value: `**Recrutamentos:** \`${entry.recruit_count}\``,
            inline: false,
        };
    }));

    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle('👥 Ranking de Recrutadores')
        .setDescription('Os oficiais que mais trouxeram novos membros para a corporação.')
        .setFields(fields.length > 0 ? fields : { name: "Nenhum recrutamento", value: "Ainda não há dados de recrutamento."})
        .setFooter({ text: `Página ${page} de ${totalPages || 1}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('recruiter_ranking_prev').setLabel('<').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
        new ButtonBuilder().setCustomId('recruiter_ranking_next').setLabel('>').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages)
    );

    return { embeds: [embed], components: [row], ephemeral: true };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rankingrec')
        .setDescription('Mostra o ranking de recrutadores da corporação.'),
    async execute(interaction) {
        const response = await interaction.deferReply({ ephemeral: true });
        
        let currentPage = 1;
        const payload = await generateRecruiterRankingEmbed(currentPage, interaction);
        await interaction.editReply(payload);

        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 // O coletor dura 1 minuto
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Apenas quem usou o comando pode navegar nas páginas.', ephemeral: true });
            }
            
            if (i.customId === 'recruiter_ranking_next') currentPage++;
            if (i.customId === 'recruiter_ranking_prev') currentPage--;

            const updatedPayload = await generateRecruiterRankingEmbed(currentPage, i);
            await i.update(updatedPayload);
        });

        collector.on('end', async () => {
            const expiredPayload = await generateRecruiterRankingEmbed(currentPage, interaction);
            expiredPayload.components.forEach(row => row.components.forEach(c => c.setDisabled(true)));
            await interaction.editReply(expiredPayload).catch(() => {});
        });
    },
};