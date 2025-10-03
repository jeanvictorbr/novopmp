const { EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('decoration_award_modal_'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const [, , , targetUserId, medalId] = interaction.customId.split('_');
        const reason = interaction.fields.getTextInputValue('award_reason');
        const awardedBy = interaction.user;

        try {
            const officer = await interaction.guild.members.fetch(targetUserId);
            const medal = await db.get('SELECT * FROM decorations_medals WHERE medal_id = $1', [medalId]);

            if (!officer || !medal) {
                return await interaction.editReply('❌ Oficial ou medalha não encontrado(a).');
            }

            // --- INÍCIO DA CORREÇÃO ---
            // Passo 1: Enviar o anúncio público primeiro para obter as IDs
            let announcementMessage = null;
            const channelId = (await db.get("SELECT value FROM settings WHERE key = 'decorations_channel_id'"))?.value;
            if (channelId) {
                const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('Aqua')
                        .setTitle('🏆 Condecoração por Mérito 🏆')
                        .setThumbnail(officer.user.displayAvatarURL())
                        .addFields(
                            { name: 'Oficial Condecorado', value: officer.toString(), inline: false },
                            { name: 'Medalha Recebida', value: `${medal.emoji || ''} **${medal.name}**`, inline: true },
                            { name: 'Concedida Por', value: awardedBy.toString(), inline: true },
                            { name: 'Justificativa', value: reason }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Comando Superior' });
                    announcementMessage = await channel.send({ embeds: [embed] });
                }
            }

            // Passo 2: Salvar o registro completo no banco de dados ANTES de dar o cargo
            await db.run(
                'INSERT INTO user_decorations (user_id, medal_id, awarded_by, awarded_at, reason, announcement_channel_id, announcement_message_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [
                    officer.id, 
                    medal.medal_id, 
                    awardedBy.id, 
                    Math.floor(Date.now() / 1000), 
                    reason,
                    announcementMessage?.channel.id,
                    announcementMessage?.id,
                    'awarded'
                ]
            );

            // Passo 3: Adicionar o cargo ao oficial por último
            await officer.roles.add(medal.role_id, `Condecorado com: ${medal.name}`);
            // --- FIM DA CORREÇÃO ---

            await interaction.editReply(`✅ **${officer.displayName}** foi condecorado com a medalha **${medal.name}**! O anúncio foi publicado.`);

        } catch (error) {
            console.error('Erro ao condecorar oficial:', error);
            await interaction.editReply('❌ Ocorreu um erro ao conceder a medalha.');
        }
    }
};