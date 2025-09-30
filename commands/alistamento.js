const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alistamento')
        .setDescription('Comandos do Módulo de Alistamento.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('painel')
                .setDescription('Envia o painel público de alistamento.')
        ),
    
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'painel') {
            await interaction.deferReply({ ephemeral: true });

            const channelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_public_channel_id'"))?.value;
            if (!channelId) return interaction.editReply('❌ O canal de alistamento não foi configurado em `/setup`.');
            
            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            if (!channel) return interaction.editReply('❌ O canal configurado não foi encontrado.');

            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle('🏛️ Central de Alistamento')
                .setDescription('Deseja juntar-se às nossas fileiras e servir a cidade com honra e bravura? Inicie o seu processo de alistamento clicando no botão abaixo.')
                .setThumbnail(interaction.guild.iconURL())
                .setImage('https://i.imgur.com/your_banner.png'); // Altere para o seu banner

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('enlistment_start').setLabel('Alistar-se').setStyle(ButtonStyle.Success).setEmoji('📝')
            );
            
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.editReply(`✅ Painel de alistamento enviado com sucesso para ${channel}.`);
        }
    },
};