const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db.js');
const { updateAcademyPanel } = require('../utils/updateAcademyPanel.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('academia')
        .setDescription('Comandos relacionados à Academia de Polícia.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('painel')
                .setDescription('Envia o painel dinâmico da Academia no canal configurado.')
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

                // Envia uma mensagem temporária que será substituída pelo painel real
                const panelMessage = await targetChannel.send({ content: 'Carregando painel da academia...' });
                
                await db.run('INSERT INTO panels (panel_type, channel_id, message_id) VALUES ($1, $2, $3) ON CONFLICT (panel_type) DO UPDATE SET channel_id = $2, message_id = $3',
                    ['academy', panelMessage.channel.id, panelMessage.id]
                );

                // Chama a função que constrói e atualiza o painel
                await updateAcademyPanel(interaction.client);

                await interaction.editReply(`✅ Painel da Academia implantado com sucesso no canal ${targetChannel}.`);

            } catch (error) {
                console.error("Erro ao postar painel da Academia:", error);
                await interaction.editReply('❌ Ocorreu um erro ao postar o painel. Verifique as permissões do bot.');
            }
        }
    },
};