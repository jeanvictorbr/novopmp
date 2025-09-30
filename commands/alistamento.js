// Local: commands/alistamento.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js'); // ADICIONADO StringSelectMenuBuilder
const db = require('../database/db.js');
const { createQuizManagerEmbed } = require('../interactions/handlers/enlistment_quiz_handler.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alistamento')
        .setDescription('Comandos do Módulo de Alistamento e Provas.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('painel')
                .setDescription('Envia o painel público de alistamento.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('painelprovas')
                .setDescription('Envia a vitrine pública de provas teóricas.')
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
        else if (subcommand === 'painelprovas') {
            await interaction.deferReply({ ephemeral: true });
            const channelId = interaction.channel.id;
            const channel = await interaction.guild.channels.fetch(channelId);

            const quizzes = await db.all("SELECT quiz_id, title FROM enlistment_quizzes");

            const embed = new EmbedBuilder()
                .setColor('Gold')
                .setTitle('🎓 Central de Provas e Certificações')
                .setDescription('Bem-vindo, oficial! Aqui você pode testar seus conhecimentos e obter certificações. Selecione uma prova no menu abaixo para começar.')
                .setThumbnail('https://i.imgur.com/ywhAV0k.png');

            if (quizzes.length === 0) {
                embed.addFields({ name: "Nenhuma prova disponível", value: "Volte mais tarde para verificar novas provas." });
                await channel.send({ embeds: [embed] });
            } else {
                const options = quizzes.map(q => ({
                    label: q.title,
                    value: `quiz_start_${interaction.user.id}_${q.quiz_id}`, // CORRIGIDO PARA O FORMATO CORRETO
                    description: `ID da Prova: ${q.quiz_id}`,
                    emoji: '✍️'
                }));
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('quiz_public_select')
                        .setPlaceholder('Selecione uma prova para realizar...')
                        .addOptions(options)
                );
                await channel.send({ embeds: [embed], components: [row] });
            }
            await interaction.editReply(`✅ Painel de provas enviado com sucesso neste canal!`);
        }
        else if (subcommand === 'criaprova') {
            await interaction.deferReply({ ephemeral: true }); // Deferir aqui para evitar falhas
            const title = interaction.options.getString('titulo');
            const passingScore = interaction.options.getInteger('nota_minima') || 70;

            const result = await db.run('INSERT INTO enlistment_quizzes (title, questions, passing_score) VALUES ($1, $2, $3) RETURNING quiz_id', [title, '[]', passingScore]);
            const quizId = result.rows[0].quiz_id;
            
            const { embeds, components } = await createQuizManagerEmbed(quizId);
            
            await interaction.editReply({ embeds, components });
        }
    },
};