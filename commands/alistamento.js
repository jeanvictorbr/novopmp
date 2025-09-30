// Local: commands/alistamento.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alistamento')
        .setDescription('Comandos do Módulo de Alistamento e Provas.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('painelprovas')
                .setDescription('Envia a vitrine pública para realização de provas teóricas.')
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
            const quizzes = await db.all("SELECT quiz_id, title FROM enlistment_quizzes");
            const embed = new EmbedBuilder()
                .setColor('Gold')
                .setTitle('🎓 Central de Provas e Certificações')
                .setDescription('Bem-vindo! Aqui você pode testar os seus conhecimentos. Selecione uma prova no menu abaixo para começar.')
                .setThumbnail('https://i.imgur.com/ywhAV0k.png');

            if (quizzes.length > 0) {
                const options = quizzes.map(q => ({
                    label: q.title,
                    value: `quiz_public_start_${q.quiz_id}`,
                    emoji: '✍️'
                }));
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('quiz_public_select').setPlaceholder('Selecione uma prova para realizar...').addOptions(options)
                );
                await channel.send({ embeds: [embed], components: [row] });
            } else {
                embed.addFields({ name: "Nenhuma prova disponível", value: "Volte mais tarde." });
                await channel.send({ embeds: [embed] });
            }
            await interaction.editReply(`✅ Painel de provas enviado com sucesso neste canal!`);

        } else if (subcommand === 'painelalistamento') {
            const channelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_form_channel_id'"))?.value;
            if (!channelId) return interaction.editReply('❌ O canal de alistamento não foi configurado em `/setup`.');

            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            if (!channel) return interaction.editReply('❌ O canal configurado não foi encontrado.');

            const bannerUrl = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_banner_url'"))?.value;
            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle('🏛️ Central de Alistamento')
                .setDescription('Deseja juntar-se às nossas fileiras e servir a cidade com honra e bravura? Clique no botão abaixo para iniciar o seu processo.')
                .setThumbnail(interaction.guild.iconURL());
            
            if (bannerUrl) embed.setImage(bannerUrl);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('enlistment_start_process').setLabel('Alistar-se').setStyle(ButtonStyle.Success).setEmoji('📝')
            );
            
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.editReply(`✅ Painel de alistamento enviado com sucesso para ${channel}!`);
        }
    },
};