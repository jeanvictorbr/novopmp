const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../database/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('limparcarreira')
        .setDescription('⚠️[ADMIN] Apaga TODOS os dados de carreira de um oficial (certificações, promoções, etc).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('oficial')
                .setDescription('O oficial cuja carreira será completamente zerada.')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('oficial');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return await interaction.editReply('❌ Oficial não encontrado no servidor.');
        }

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('⚠️ CONFIRMAÇÃO DE AÇÃO DESTRUTIVA ⚠️')
            .setDescription(`**Você tem a certeza absoluta que deseja apagar permanentemente todos os dados de carreira de ${member.toString()}?**\n\nIsto irá remover:\n- Todas as certificações da academia\n- Todas as condecorações (medalhas)\n- Todo o histórico de promoções\n- Todas as conquistas desbloqueadas\n- Todos os stats manuais\n- **TODOS os cargos associados a estes itens.**\n\n**ESTA AÇÃO É IRREVERSÍVEL.**`);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`confirm_wipe_${member.id}`).setLabel('Sim, Apagar Carreira').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_wipe').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );

        const confirmationMessage = await interaction.editReply({ embeds: [embed], components: [buttons] });

        const collector = confirmationMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === interaction.user.id,
            time: 15000,
            max: 1
        });

        collector.on('collect', async i => {
            if (i.customId === 'cancel_wipe') {
                return await i.update({ content: 'Ação cancelada.', embeds: [], components: [] });
            }

            if (i.customId === `confirm_wipe_${member.id}`) {
                await i.update({ content: 'Processando a limpeza completa...', embeds: [], components: [] });

                try {
                    // 1. Obter todos os cargos a serem removidos
                    const courseRoles = await db.all('SELECT role_id FROM academy_courses');
                    const medalRoles = await db.all('SELECT role_id FROM decorations_medals');
                    const careerRoles = await db.all('SELECT role_id FROM rank_history WHERE user_id = $1', [member.id]);
                    const rolesToRemove = new Set([
                        ...courseRoles.map(r => r.role_id),
                        ...medalRoles.map(r => r.role_id),
                        ...careerRoles.map(r => r.role_id)
                    ]);

                    for (const roleId of rolesToRemove) {
                        if (member.roles.cache.has(roleId)) {
                            await member.roles.remove(roleId, `Carreira limpa por ${interaction.user.tag}`).catch(console.error);
                        }
                    }

                    // 2. Apagar todos os registos da base de dados
                    await db.run('DELETE FROM user_certifications WHERE user_id = $1', [member.id]);
                    await db.run('DELETE FROM user_decorations WHERE user_id = $1', [member.id]);
                    await db.run('DELETE FROM rank_history WHERE user_id = $1', [member.id]);
                    await db.run('DELETE FROM user_achievements WHERE user_id = $1', [member.id]);
                    await db.run('DELETE FROM manual_stats WHERE user_id = $1', [member.id]);

                    await i.followUp({ content: `✅ Todos os dados de carreira e cargos associados de ${member.toString()} foram apagados com sucesso.`, ephemeral: true });

                } catch (error) {
                    console.error("Erro ao limpar carreira:", error);
                    await i.followUp({ content: '❌ Ocorreu um erro ao tentar apagar os dados.', ephemeral: true });
                }
            }
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ content: 'A confirmação expirou.', embeds: [], components: [] });
            }
        });
    },
};