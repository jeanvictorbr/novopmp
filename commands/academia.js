const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('academia')
        .setDescription('Comandos relacionados à Academia de Polícia.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('painel')
                .setDescription('Envia o painel de inscrição da Academia no canal configurado.')
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'painel') {
            await interaction.deferReply({ ephemeral: true });
            
            try {
                const academyChannelId = (await db.get('SELECT value FROM settings WHERE key = $1', ['academy_channel_id']))?.value;

                if (!academyChannelId) {
                    return await interaction.editReply('❌ O canal da Academia ainda não foi configurado. Use `/setup` para configurá-lo.');
                }
                
                const targetChannel = await interaction.guild.channels.fetch(academyChannelId).catch(() => null);
                if (!targetChannel) {
                    return await interaction.editReply('❌ O canal da Academia configurado não foi encontrado.');
                }

                const courses = await db.all('SELECT * FROM academy_courses');

                // CORREÇÃO: Embed completamente redesenhada para ser mais imersiva
                const embed = new EmbedBuilder()
                    .setColor('Gold')
                    .setTitle('🎓 Academia de Polícia - Inscrições Abertas')
                    .setDescription('Bem-vindo à Academia, oficial! Explore os cursos de especialização disponíveis para aprimorar suas habilidades em campo. Selecione um curso no menu abaixo para iniciar sua inscrição.')
                    .setThumbnail('https://i.imgur.com/ywhAV0k.png') // Ícone de academia
                    .setImage('https://i.imgur.com/z4PE1f6.jpeg') // Banner da academia
                    .setFooter({ text: 'Phoenix • Sistema de Gestão Policial', iconURL: interaction.guild.iconURL() })
                    .setTimestamp();

                if (courses.length > 0) {
                    courses.forEach(course => {
                        // Tenta encontrar o cargo no cache do servidor para mencioná-lo
                        const role = interaction.guild.roles.cache.get(course.role_id);
                        const roleMention = role ? role.toString() : '`Não configurado`';

                        embed.addFields({
                            name: `\u200B\n📚 **${course.name}**`, // Adiciona um espaço em branco para separar os cursos
                            value: `**ID do Curso:** \`${course.course_id}\`\n` +
                                   `**🕒 Requisito:** ${course.required_hours > 0 ? `\`${course.required_hours}\`h de patrulha` : 'Nenhum'}\n` +
                                   `**🎖️ Cargo Concedido:** ${roleMention}\n` +
                                   `**📝 Descrição:** *${course.description}*`
                        });
                    });
                } else {
                    embed.addFields({ 
                        name: '\u200B\nNenhum curso disponível', 
                        value: 'Fique atento para a abertura de novas turmas e cursos de especialização.' 
                    });
                }


                const selectMenu = new ActionRowBuilder();
                if (courses.length > 0) {
                    const options = courses.map(course => ({
                        label: course.name,
                        description: `Requisitos: ${course.required_hours > 0 ? `${course.required_hours}h` : 'Nenhum'}`,
                        value: course.course_id,
                    }));

                    selectMenu.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('academy_enroll_select')
                            .setPlaceholder('Selecione um curso para se inscrever...')
                            .addOptions(options)
                    );
                }

                const panelMessage = await targetChannel.send({ embeds: [embed], components: courses.length > 0 ? [selectMenu] : [] });
                
                await db.run('INSERT INTO panels (panel_type, channel_id, message_id) VALUES ($1, $2, $3) ON CONFLICT (panel_type) DO UPDATE SET channel_id = $2, message_id = $3',
                    ['academy', panelMessage.channel.id, panelMessage.id]
                );

                await interaction.editReply(`✅ Painel da Academia implantado com sucesso no canal ${targetChannel}.`);

            } catch (error) {
                console.error("Erro ao postar painel da Academia:", error);
                await interaction.editReply('❌ Ocorreu um erro ao postar o painel da Academia. Verifique se o bot tem as permissões corretas.');
            }
        }
    },
};