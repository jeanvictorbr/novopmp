const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alistamento')
        .setDescription('Comandos do Módulo de Alistamento V2.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('painelprovas')
                .setDescription('Envia o painel público para realização de provas teóricas.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('painelalistamento')
                .setDescription('Envia o painel para o processo de alistamento.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'painelprovas') {
            const channel = interaction.channel;
            const embed = new EmbedBuilder()
                .setColor('Gold')
                .setTitle('🎓 Central de Provas Teóricas')
                .setDescription('`Para prosseguir com o seu alistamento, você deve primeiro ser aprovado na prova teórica. Selecione a prova designada abaixo para começar.`')
                .setThumbnail('https://media.tenor.com/UXdtXhsNMFkAAAAj/writing-om-nom.gif');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('quiz_public_start')
                    .setLabel('Iniciar Prova Teórica')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✍️')
            );
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.editReply(`✅ Painel de provas V2 enviado com sucesso neste canal!`);

        } else if (subcommand === 'painelalistamento') {
            const channelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_form_channel_id'"))?.value;
            if (!channelId) return interaction.editReply('❌ O "Canal de Alistamento" não foi configurado em `/setup`.');

            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            if (!channel) return interaction.editReply('❌ O canal configurado não foi encontrado.');

            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle('🏛️ Central de Alistamento')
                .setDescription('Deseja juntar-se às nossas fileiras e servir a cidade com honra e bravura? Clique no botão abaixo para preencher sua ficha de alistamento.')
                .setThumbnail(interaction.guild.iconURL());

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('enlistment_start_process').setLabel('Alistar-se').setStyle(ButtonStyle.Success).setEmoji('📝')
            );
            
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.editReply(`✅ Painel de alistamento V2 enviado com sucesso para ${channel}!`);
        }
    },
};