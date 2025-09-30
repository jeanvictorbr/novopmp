// Local: commands/alistamento.js

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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('criaprova')
                .setDescription('Cria uma nova prova teórica para o alistamento.')
                .addStringOption(option => option.setName('titulo').setDescription('O título da prova (Ex: Prova Teórica para Recrutas)').setRequired(true))
                .addIntegerOption(option => option.setName('nota_minima').setDescription('Nota mínima (0-100) para aprovação. Padrão: 70.').setRequired(false))
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'painel') {
            await interaction.deferReply({ ephemeral: true });

            const channelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_public_channel_id'"))?.value;
            if (!channelId) return interaction.editReply('❌ O canal de alistamento não foi configurado em `/setup`.');
            
            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            if (!channel) return interaction.editReply('❌ O canal configurado não foi encontrado.');

            const bannerUrl = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_banner_url'"))?.value;

            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle('🏛️ Central de Alistamento')
                .setDescription('Deseja juntar-se às nossas fileiras e servir a cidade com honra e bravura? Inicie o seu processo de alistamento clicando no botão abaixo.')
                .setThumbnail(interaction.guild.iconURL());
            
            if (bannerUrl) {
                embed.setImage(bannerUrl);
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('enlistment_start').setLabel('Alistar-se').setStyle(ButtonStyle.Success).setEmoji('📝')
            );
            
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.editReply(`✅ Painel de alistamento enviado com sucesso para ${channel}.`);
        }
        else if (subcommand === 'criaprova') {
            const title = interaction.options.getString('titulo');
            const passingScore = interaction.options.getInteger('nota_minima') || 70;

            // Aqui, apenas iniciamos o processo. A lógica de adicionar perguntas será feita via botões.
            const result = await db.run('INSERT INTO enlistment_quizzes (title, questions, passing_score) VALUES ($1, $2, $3) RETURNING quiz_id', [title, '[]', passingScore]);
            const quizId = result.rows[0].quiz_id;

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle(`📝 Prova Criada: ${title}`)
                .setDescription('A prova foi criada com sucesso! Agora, adicione as perguntas usando o botão abaixo.')
                .addFields(
                    { name: 'ID da Prova', value: `\`${quizId}\``, inline: true },
                    { name: 'Nota Mínima', value: `\`${passingScore}%\``, inline: true }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`quiz_add_question_${quizId}`)
                    .setLabel('Adicionar Pergunta')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('➕')
            );
            
            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
    },
};