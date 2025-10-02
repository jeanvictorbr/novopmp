const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');

// Centraliza as definições dos tipos de conquista para fácil reutilização
const achievementTypes = {
    'patrol_hours': { name: 'Horas de Patrulha', unit: 'Horas' },
    'recruits': { name: 'Recrutas Aprovados', unit: 'Recrutas' },
    'courses': { name: 'Cursos Concluídos', unit: 'Cursos' }
};

const achievementHandler = {
    customId: (id) => id.startsWith('achievements_'),

    async execute(interaction) {
        const { customId } = interaction;
        try {
            // FLUXO DE ADICIONAR
            if (customId === 'achievements_add') return await this.startAddFlow(interaction);
            if (customId === 'achievements_type_select') return await this.showAddModal(interaction);
            if (customId.startsWith('achievements_add_modal_')) return await this.handleAddModal(interaction);
            
            // FLUXO DE REMOVER
            if (customId === 'achievements_remove') return await this.showRemoveSelect(interaction);
            if (customId === 'achievements_remove_select') return await this.handleRemoveSelect(interaction);

        } catch (error) {
            console.error(`Erro no handler de conquistas (${customId}):`, error);
        }
    },

    // Etapa 1 do Fluxo de Adicionar: Selecionar o Tipo
    async startAddFlow(interaction) {
        const typeOptions = Object.entries(achievementTypes).map(([id, { name }]) => ({
            label: name,
            value: id
        }));

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('achievements_type_select')
                .setPlaceholder('Selecione o tipo de conquista a criar...')
                .addOptions(typeOptions)
        );

        await interaction.reply({ content: '**Passo 1 de 2:** Qual o tipo de requisito para a nova conquista?', components: [menu], ephemeral: true });
    },
    
    // Etapa 2 do Fluxo de Adicionar: Preencher o Formulário
    async showAddModal(interaction) {
        const type = interaction.values[0];
        const typeName = achievementTypes[type]?.name || 'Desconhecido';

        const modal = new ModalBuilder()
            .setCustomId(`achievements_add_modal_${type}`)
            .setTitle(`Nova Conquista: ${typeName}`);

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_id').setLabel("ID da Conquista (curto, sem espaços)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: patrol_100')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_name').setLabel("Nome da Conquista").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: Patrulheiro Dedicado')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_desc').setLabel("Descrição").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ach_req').setLabel(`Requisito Numérico (${achievementTypes[type]?.unit})`).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: 100'))
        );

        await interaction.showModal(modal);
    },

    async handleAddModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const type = interaction.customId.split('_').pop();
        
        const id = interaction.fields.getTextInputValue('ach_id').toLowerCase();
        const name = interaction.fields.getTextInputValue('ach_name');
        const description = interaction.fields.getTextInputValue('ach_desc');
        const requirement = parseInt(interaction.fields.getTextInputValue('ach_req'));

        if (isNaN(requirement) || requirement <= 0) {
            return await interaction.editReply('❌ O requisito numérico deve ser um número maior que zero.');
        }

        try {
            await db.run(
                'INSERT INTO achievements (achievement_id, name, description, type, requirement) VALUES ($1, $2, $3, $4, $5)',
                [id, name, description, type, requirement]
            );
            
            // --- CORREÇÃO APLICADA AQUI ---
            // A linha que tentava editar a mensagem anterior foi removida.
            // Agora, apenas confirmamos a ação para o modal, evitando o erro.
            await interaction.editReply({content: '✅ Conquista criada com sucesso! O painel será atualizado quando voltares.'});

        } catch (error) {
            if (error.code === '23505') {
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
        
        await interaction.editReply({ content: '✅ Conquista removida com sucesso! O painel será atualizado quando voltares.', components: [] });
    }
};

module.exports = achievementHandler;