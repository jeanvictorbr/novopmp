const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('denunciar')
        .setDescription('Comandos do sistema de denúncias da Corregedoria.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('painel')
                .setDescription('Envia o painel para abertura de denúncias no canal configurado.')
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'painel') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const publicChannelId = (await db.get("SELECT value FROM settings WHERE key = 'corregedoria_public_channel_id'"))?.value;
                if (!publicChannelId) {
                    return await interaction.editReply('❌ O canal público de denúncias não foi configurado. Use `/setup` para configurá-lo.');
                }

                const targetChannel = await interaction.guild.channels.fetch(publicChannelId).catch(() => null);
                if (!targetChannel) {
                    return await interaction.editReply('❌ O canal de denúncias configurado não foi encontrado ou não existe mais.');
                }

                const embed = new EmbedBuilder()
                    .setColor('DarkRed')
                    .setTitle('⚖️ Canal de Denúncias da Corregedoria')
                    .setDescription(
                        'Este é o canal oficial para registrar denúncias, reclamações ou reportar condutas inadequadas de forma segura e confidencial.\n\n' +
                        'Para iniciar, clique no botão **"Abrir Denúncia"** abaixo. Um formulário privado será aberto para que você possa detalhar sua ocorrência.'
                    )
                    .addFields({
                        name: 'Confidencialidade Garantida',
                        value: 'A sua identidade será mantida em sigilo e a denúncia será encaminhada diretamente aos membros da Corregedoria para uma investigação imparcial.'
                    })
                    .setThumbnail('https://i.imgur.com/sR32sQ8.png') // Ícone de balança
                    .setFooter({ text: 'A integridade da corporação depende da sua colaboração.' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('corregedoria_open_ticket')
                        .setLabel('Abrir Denúncia')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🚨')
                );

                await targetChannel.send({ embeds: [embed], components: [row] });
                await interaction.editReply(`✅ Painel de denúncias implantado com sucesso no canal ${targetChannel}.`);

            } catch (error) {
                console.error("Erro ao implantar painel de denúncias:", error);
                await interaction.editReply('❌ Ocorreu um erro ao tentar implantar o painel. Verifique as permissões do bot no canal de destino.');
            }
        }
    },
};