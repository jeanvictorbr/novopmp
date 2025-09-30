const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('registrar')
        .setDescription('Comandos do Módulo de Registros de Oficiais.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('painel')
                .setDescription('Envia o painel público de consulta de registros de oficiais.')
        ),
    
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'painel') {
            await interaction.deferReply({ ephemeral: true });

            const channelId = (await db.get("SELECT value FROM settings WHERE key = 'records_public_channel_id'"))?.value;
            if (!channelId) {
                return interaction.editReply('❌ O canal público de registros não foi configurado. Defina-o primeiro em `/setup`.');
            }
            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                return interaction.editReply('❌ O canal configurado não foi encontrado.');
            }

            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle('🏛️ Departamento de Registros Oficiais')
                .setDescription('Utilize o botão abaixo para consultar o registro de um oficial através do seu número de distintivo.')
                .setThumbnail(interaction.guild.iconURL())
                .setImage('https://i.imgur.com/your_banner.png') // Banner genérico, pode ser configurado
                .setFooter({ text: 'A transparência e a organização são os pilares da nossa corporação.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('records_public_lookup')
                    .setLabel('Consultar por Distintivo')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔎')
            );
            
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.editReply(`✅ Painel de consulta de registros enviado com sucesso para ${channel}.`);
        }
    },
};