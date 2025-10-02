const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adminstats')
        .setDescription('Adiciona ou define estatísticas para um oficial (para testes).')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addUserOption(option => option.setName('oficial').setDescription('O oficial a ser modificado.').setRequired(true))
        .addStringOption(option => option.setName('stat').setDescription('A estatística a ser alterada.').setRequired(true).addChoices(
            { name: 'Horas de Patrulha', value: 'patrol_hours' },
            { name: 'Recrutas Aprovados', value: 'recruits' },
            { name: 'Cursos Concluídos', value: 'courses' }
        ))
        .addStringOption(option => option.setName('acao').setDescription('A ação a ser realizada.').setRequired(true).addChoices(
            { name: 'Definir (substitui o valor)', value: 'set' },
            { name: 'Adicionar (soma ao valor)', value: 'add' }
        ))
        .addIntegerOption(option => option.setName('valor').setDescription('O valor numérico.').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('oficial');
        const stat = interaction.options.getString('stat');
        const action = interaction.options.getString('acao');
        const value = interaction.options.getInteger('valor');

        const columnMap = {
            patrol_hours: 'manual_patrol_hours',
            recruits: 'manual_recruits',
            courses: 'manual_courses',
        };
        const columnName = columnMap[stat];
        const friendlyName = stat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

        try {
            if (action === 'set') {
                await db.run(
                    `INSERT INTO manual_stats (user_id, ${columnName}) VALUES ($1, $2)
                     ON CONFLICT (user_id) DO UPDATE SET ${columnName} = $2`,
                    [targetUser.id, value]
                );
                await interaction.editReply(`✅ As **${friendlyName}** manuais de ${targetUser.username} foram definidas para \`${value}\`.`);
            } else { // action === 'add'
                await db.run(
                    `INSERT INTO manual_stats (user_id, ${columnName}) VALUES ($1, $2)
                     ON CONFLICT (user_id) DO UPDATE SET ${columnName} = manual_stats.${columnName} + $2`,
                    [targetUser.id, value]
                );
                await interaction.editReply(`✅ Foram adicionadas \`${value}\` **${friendlyName}** manuais a ${targetUser.username}.`);
            }
        } catch (error) {
            console.error('Erro ao executar /adminstats:', error);
            await interaction.editReply('❌ Ocorreu um erro ao tentar modificar as estatísticas.');
        }
    },
};