const { EmbedBuilder } = require('discord.js');
const db = require('../../../database/db.js');

module.exports = {
    customId: (customId) => customId.startsWith('promote_modal_'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const [, , userId, newRoleId] = interaction.customId.split('_');
        const reason = interaction.fields.getTextInputValue('promotion_reason');

        const officer = await interaction.guild.members.fetch(userId);
        const newRole = await interaction.guild.roles.fetch(newRoleId);
        
        if (!officer || !newRole) {
            return interaction.editReply('❌ Oficial ou novo cargo inválido.');
        }

        try {
            await officer.roles.add(newRole);

            const promotionTimestamp = Math.floor(Date.now() / 1000);
            await db.run(
                'INSERT INTO rank_history (user_id, role_id, promoted_at) VALUES ($1, $2, $3)',
                [userId, newRoleId, promotionTimestamp]
            );
            
            const channelId = (await db.get("SELECT value FROM settings WHERE key = 'decorations_channel_id'"))?.value;
            if (channelId) {
                const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                if (channel) {
                    const imageUrl = (await db.get("SELECT value FROM settings WHERE key = 'decorations_promote_image_url'"))?.value;
                    const embed = new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setAuthor({ name: 'DEPARTAMENTO DE RECURSOS HUMANOS', iconURL: interaction.guild.iconURL() })
                        .setTitle('📈 Promoção por Mérito')
                        .setDescription(`Parabéns ao oficial **${officer.displayName}** por sua dedicação e serviço exemplar à corporação!`)
                        .setThumbnail(officer.user.displayAvatarURL())
                        .addFields(
                            { name: 'Oficial Promovido', value: officer.toString(), inline: true },
                            { name: 'Novo Cargo', value: newRole.toString(), inline: true },
                            { name: 'Promovido Por', value: interaction.user.toString() },
                            { name: '📜 Justificativa', value: `*${reason}*` }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Phoenix • Sistema de Carreira' });
                        
                    if (imageUrl) {
                        embed.setImage(imageUrl);
                    }
                        
                    const announcementMessage = await channel.send({ content: `||${officer.toString()}||`, embeds: [embed] });
                    await announcementMessage.react('✅');
                }
            }
            await interaction.editReply(`✅ **${officer.displayName}** foi promovido para **${newRole.name}**! O anúncio foi publicado.`);
            
        } catch (error) {
            console.error('Erro ao promover:', error);
            await interaction.editReply('❌ Ocorreu um erro ao executar a promoção. Verifique minhas permissões.');
        }
    }
};