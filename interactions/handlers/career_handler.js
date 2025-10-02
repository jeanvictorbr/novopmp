const { RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { getDecorationsMenuPayload, getCareerRequirementsMenuPayload } = require('../../views/setup_views.js');

// Armazena temporariamente a seleção do primeiro cargo
const stepCache = new Map();

const careerHandler = {
    customId: (id) => id.startsWith('career_'),

    async execute(interaction) {
        const { customId } = interaction;
        try {
            if (customId === 'career_manage_requirements') {
                const payload = await getCareerRequirementsMenuPayload(db, interaction.guild);
                await interaction.update(payload);
            }
            if (customId === 'career_add_step') {
                return await this.startAddStepFlow(interaction);
            }
            if (customId === 'career_select_previous_role') {
                return await this.handlePreviousRoleSelect(interaction);
            }
            if (customId === 'career_select_new_role') {
                return await this.handleNewRoleSelect(interaction);
            }
            if (customId.startsWith('career_set_requirements_modal')) {
                return await this.handleRequirementsModal(interaction);
            }
            if (customId === 'career_remove_step') {
                 return await this.showRemoveStepSelect(interaction);
            }
            if (customId === 'career_remove_step_select') {
                return await this.handleRemoveStep(interaction);
            }
             if (customId === 'back_to_decorations_menu') {
                const payload = await getDecorationsMenuPayload(db);
                await interaction.update(payload);
            }


        } catch (error) {
            console.error(`Erro no handler de carreira (${customId}):`, error);
        }
    },

    async startAddStepFlow(interaction) {
        const menu = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('career_select_previous_role')
                .setPlaceholder('Selecione o Cargo ATUAL (o que o oficial tem)')
        );
        await interaction.reply({ content: '**Etapa 1 de 3:** Selecione o cargo que o oficial precisa ter ANTES da promoção.', components: [menu], ephemeral: true });
    },

    async handlePreviousRoleSelect(interaction) {
        const previousRoleId = interaction.values[0];
        stepCache.set(interaction.user.id, { previousRoleId });

        const menu = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('career_select_new_role')
                .setPlaceholder('Selecione o Cargo de DESTINO da promoção')
        );
        await interaction.update({ content: '**Etapa 2 de 3:** Agora, selecione o novo cargo para o qual o oficial será promovido.', components: [menu] });
    },

    async handleNewRoleSelect(interaction) {
        const newRoleId = interaction.values[0];
        const cachedStep = stepCache.get(interaction.user.id);
        if (!cachedStep) {
            return await interaction.update({ content: '❌ A sua sessão expirou. Por favor, comece de novo.', components: [] });
        }
        const { previousRoleId } = cachedStep;
        stepCache.delete(interaction.user.id); // Limpa o cache

        const modal = new ModalBuilder()
            .setCustomId(`career_set_requirements_modal_${previousRoleId}_${newRoleId}`)
            .setTitle('Definir Requisitos de Promoção');

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('req_hours').setLabel("Horas de Patrulha Necessárias").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: 50')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('req_courses').setLabel("Nº de Cursos Concluídos Necessários").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: 2')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('req_recruits').setLabel("Nº de Recrutas Aprovados Necessários").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: 3')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('req_time').setLabel("Dias Mínimos no Cargo Anterior").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: 30'))
        );
        await interaction.showModal(modal);
    },

    async handleRequirementsModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const [, , previousRoleId, newRoleId] = interaction.customId.split('_');

        const hours = parseInt(interaction.fields.getTextInputValue('req_hours')) || 0;
        const courses = parseInt(interaction.fields.getTextInputValue('req_courses')) || 0;
        const recruits = parseInt(interaction.fields.getTextInputValue('req_recruits')) || 0;
        const time = parseInt(interaction.fields.getTextInputValue('req_time')) || 0;

        await db.run(
            'INSERT INTO rank_requirements (role_id, previous_role_id, required_patrol_hours, required_courses, required_recruits, required_time_in_rank_days) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (role_id) DO UPDATE SET previous_role_id = $2, required_patrol_hours = $3, required_courses = $4, required_recruits = $5, required_time_in_rank_days = $6',
            [newRoleId, previousRoleId, hours, courses, recruits, time]
        );
        await interaction.editReply({ content: '✅ Requisitos de promoção salvos com sucesso! O painel será atualizado quando voltares.' });
    },
     async showRemoveStepSelect(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const requirements = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
        if (requirements.length === 0) return await interaction.editReply({ content: 'Não há requisitos configurados para remover.' });

        const options = await Promise.all(requirements.map(async r => {
            const prevRole = await interaction.guild.roles.fetch(r.previous_role_id).catch(() => null);
            const newRole = await interaction.guild.roles.fetch(r.role_id).catch(() => null);
            return {
                label: `${prevRole ? prevRole.name : 'Cargo Apagado'} -> ${newRole ? newRole.name : 'Cargo Apagado'}`,
                value: r.role_id // O ID do cargo de destino é a chave primária
            };
        }));

        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('career_remove_step_select').setPlaceholder('Selecione o requisito a ser removido...').addOptions(options));
        await interaction.editReply({ components: [menu] });
    },

    async handleRemoveStep(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const roleIdToRemove = interaction.values[0];
        await db.run('DELETE FROM rank_requirements WHERE role_id = $1', [roleIdToRemove]);
        await interaction.editReply({ content: '✅ Requisito de promoção removido com sucesso!', components: [] });
    }
};

module.exports = careerHandler;