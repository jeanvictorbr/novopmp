const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { getAchievementsMenuPayload } = require('../../views/setup_views.js');

const achievementHandler = {
    customId: (id) => id.startsWith('achievements_'),

    async execute(interaction) {
        const { customId } = interaction;
        try {
            if (customId === 'achievements_add') return await this.showAddModal(interaction);
            if (customId === 'achievements_add_modal') return await this.handleAddModal(interaction);
            if (customId === 'achievements_remove') return await this.showRemoveSelect(interaction);
            if (customId === 'achievements_remove_select') return await this.handleRemoveSelect(interaction);

        } catch (error) {
            console.error(`Erro no handler de conquistas (${customId}):`, error);
        }
    },

    async showAddModal(interaction) {
        const modal = new ModalBuilder().setCustomId('achievements_add_modal').setTitle('Criar Nova Conquista');
        
        const typeOptions = [
            { label: 'Horas de Patrulha', value: 'patrol_hours' },
            { label: 'Recrutas Aprovados', value: 'recruits' },
            { label: 'Cursos Concluídos', value: 'courses' }
        ];

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_id').setLabel("ID da Conquista (curto, sem espaços)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: patrol_100')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_name').setLabel("Nome da Conquista").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: Patrulheiro Dedicado')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_desc').setLabel("Descrição").setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Ex: Completou 100 horas de patrulha.')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_icon').setLabel("Ícone (Emoji)").setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Ex: 🏆')),
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ach_type_select') // Este será processado dentro do modal handler
                    .setPlaceholder('Selecione o Tipo de Requisito')
                    .addOptions(typeOptions)
            ),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_req').setLabel("Requisito Numérico").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: 100'))
        );
        
        // StringSelectMenu não é suportado em Modals, vamos apresentar de forma diferente.
        const modalUpdated = new ModalBuilder().setCustomId('achievements_add_modal').setTitle('Criar Nova Conquista');
         modalUpdated.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_id').setLabel("ID da Conquista (curto, sem espaços)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: patrol_100')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_name').setLabel("Nome da Conquista").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: Patrulheiro Dedicado')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_desc').setLabel("Descrição").setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Ex: Completou 100 horas de patrulha.')),
             new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_type').setLabel("Tipo (patrol_hours, recruits, courses)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Escolha um dos tipos válidos')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_req').setLabel("Requisito Numérico").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: 100'))
        );

        await interaction.showModal(modalUpdated);
    },

    async handleAddModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const id = interaction.fields.getTextInputValue('ach_id').toLowerCase();
        const name = interaction.fields.getTextInputValue('ach_name');
        const description = interaction.fields.getTextInputValue('ach_desc');
        const type = interaction.fields.getTextInputValue('ach_type').toLowerCase();
        const requirement = parseInt(interaction.fields.getTextInputValue('ach_req'));

        const validTypes = ['patrol_hours', 'recruits', 'courses'];
        if (!validTypes.includes(type)) {
            return await interaction.editReply(`❌ Tipo inválido. Use um dos seguintes: ${validTypes.join(', ')}`);
        }
        if (isNaN(requirement) || requirement <= 0) {
            return await interaction.editReply('❌ O requisito numérico deve ser um número maior que zero.');
        }

        try {
            await db.run(
                'INSERT INTO achievements (achievement_id, name, description, type, requirement) VALUES ($1, $2, $3, $4, $5)',
                [id, name, description, type, requirement]
            );
            await interaction.editReply('✅ Conquista criada com sucesso! O painel será atualizado quando voltares.');
        } catch (error) {
            if (error.code === '23505') { // Chave primária duplicada
                await interaction.editReply(`❌ Já existe uma conquista com o ID \`${id}\`. Por favor, escolhe um ID único.`);
            } else {
                console.error(error);
                await interaction.editReply('❌ Ocorreu um erro ao guardar a conquista na base de dados.');
            }
        }
    },
    
    async showRemoveSelect(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const achievements = await db.all('SELECT achievement_id, name FROM achievements ORDER BY name ASC');
        if (achievements.length === 0) {
            return await interaction.editReply({ content: 'Não há conquistas configuradas para remover.' });
        }
        const options = achievements.map(ach => ({
            label: ach.name,
            value: ach.achievement_id
        }));
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('achievements_remove_select')
                .setPlaceholder('Selecione a conquista a ser removida...')
                .addOptions(options)
        );
        await interaction.editReply({ components: [menu] });
    },
    
    async handleRemoveSelect(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const achievementIdToRemove = interaction.values[0];
        await db.run('DELETE FROM achievements WHERE achievement_id = $1', [achievementIdToRemove]);
        await interaction.editReply({ content: '✅ Conquista removida com sucesso!', components: [] });
    }
};

module.exports = achievementHandler;