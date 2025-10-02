const { RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { getDecorationsMenuPayload, getCareerRequirementsMenuPayload } = require('../../views/setup_views.js');

// Armazena temporariamente a seleção do primeiro cargo para o fluxo de adição
const stepCache = new Map();

const careerHandler = {
    customId: (id) => id.startsWith('career_') || id.startsWith('back_to_decorations_menu'),

    async execute(interaction) {
        const { customId } = interaction;
        try {
            if (customId === 'career_manage_requirements') {
                const payload = await getCareerRequirementsMenuPayload(db, interaction);
                await interaction.update(payload);
            }
            // FLUXO DE ADICIONAR
            else if (customId === 'career_add_step') { return await this.startAddStepFlow(interaction); }
            else if (customId === 'career_select_previous_role') { return await this.handlePreviousRoleSelect(interaction); }
            else if (customId === 'career_select_new_role') { return await this.handleNewRoleSelect(interaction); }
            else if (customId.startsWith('career_set_requirements_modal')) { return await this.handleRequirementsModal(interaction, 'add'); }
            
            // FLUXO DE EDITAR (NOVO)
            else if (customId === 'career_edit_step') { return await this.startEditStepFlow(interaction); }
            else if (customId === 'career_edit_step_select') { return await this.handleEditStepSelect(interaction); }
            else if (customId.startsWith('career_edit_requirements_modal')) { return await this.handleRequirementsModal(interaction, 'edit'); }

            // FLUXO DE REMOVER
            else if (customId === 'career_remove_step') { return await this.showRemoveStepSelect(interaction); }
            else if (customId === 'career_remove_step_select') { return await this.handleRemoveStep(interaction); }
            
            // VOLTAR
            else if (customId === 'back_to_decorations_menu') {
                const payload = await getDecorationsMenuPayload(db);
                await interaction.update(payload);
            }
        } catch (error) { 
            console.error(`Erro no handler de carreira (${customId}):`, error); 
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Ocorreu um erro ao processar esta ação.', ephemeral: true }).catch(() => {});
            } else {
                await interaction.followUp({ content: '❌ Ocorreu um erro ao processar esta ação.', ephemeral: true }).catch(() => {});
            }
        }
    },

    // --- Funções do Fluxo de Adicionar ---
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
        stepCache.delete(interaction.user.id);

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

    // --- Funções do Fluxo de Edição ---
    async startEditStepFlow(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const requirements = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
        if (requirements.length === 0) return await interaction.editReply({ content: 'Não há requisitos configurados para editar.' });

        const options = requirements.map(r => {
            const prevRole = interaction.guild.roles.cache.get(r.previous_role_id);
            const newRole = interaction.guild.roles.cache.get(r.role_id);
            return {
                label: `${prevRole ? prevRole.name : 'Apagado'} -> ${newRole ? newRole.name : 'Apagado'}`,
                value: r.role_id
            };
        });

        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('career_edit_step_select').setPlaceholder('Selecione a etapa de carreira para editar...').addOptions(options));
        await interaction.editReply({ content: "Selecione a progressão que deseja editar:", components: [menu] });
    },

    async handleEditStepSelect(interaction) {
        const roleIdToEdit = interaction.values[0];
        const requirement = await db.get('SELECT * FROM rank_requirements WHERE role_id = $1', [roleIdToEdit]);
        if (!requirement) return await interaction.update({ content: "❌ Esta etapa de carreira não foi encontrada.", components: [] });

        const modal = new ModalBuilder()
            .setCustomId(`career_edit_requirements_modal_${roleIdToEdit}`)
            .setTitle('Editar Requisitos de Promoção');

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('req_hours').setLabel("Horas de Patrulha").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(requirement.required_patrol_hours))),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('req_courses').setLabel("Nº de Cursos").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(requirement.required_courses))),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('req_recruits').setLabel("Nº de Recrutas").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(requirement.required_recruits))),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('req_time').setLabel("Dias no Cargo").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(requirement.required_time_in_rank_days)))
        );
        await interaction.showModal(modal);
    },

    // --- Funções do Fluxo de Remoção ---
    async showRemoveStepSelect(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const requirements = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
        if (requirements.length === 0) return await interaction.editReply({ content: 'Não há requisitos configurados para remover.' });

        const options = requirements.map(r => {
            const prevRole = interaction.guild.roles.cache.get(r.previous_role_id);
            const newRole = interaction.guild.roles.cache.get(r.role_id);
            return {
                label: `${prevRole ? prevRole.name : 'Apagado'} -> ${newRole ? newRole.name : 'Apagado'}`,
                value: r.role_id
            };
        });

        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('career_remove_step_select').setPlaceholder('Selecione o requisito a ser removido...').addOptions(options));
        await interaction.editReply({ components: [menu] });
    },

    async handleRemoveStep(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const roleIdToRemove = interaction.values[0];
        await db.run('DELETE FROM rank_requirements WHERE role_id = $1', [roleIdToRemove]);
        await interaction.editReply({ content: '✅ Requisito de promoção removido com sucesso!', components: [] });
    },

    // --- Função Única para Salvar (Adicionar ou Editar) ---
    async handleRequirementsModal(interaction, mode) {
        await interaction.deferReply({ ephemeral: true });
        const parts = interaction.customId.split('_');
        
        const hours = parseInt(interaction.fields.getTextInputValue('req_hours')) || 0;
        const courses = parseInt(interaction.fields.getTextInputValue('req_courses')) || 0;
        const recruits = parseInt(interaction.fields.getTextInputValue('req_recruits')) || 0;
        const time = parseInt(interaction.fields.getTextInputValue('req_time')) || 0;

        if (mode === 'add') {
            const previousRoleId = parts[4];
            const newRoleId = parts[5];
            await db.run(
                'INSERT INTO rank_requirements (role_id, previous_role_id, required_patrol_hours, required_courses, required_recruits, required_time_in_rank_days) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (role_id) DO UPDATE SET previous_role_id = $2, required_patrol_hours = $3, required_courses = $4, required_recruits = $5, required_time_in_rank_days = $6',
                [newRoleId, previousRoleId, hours, courses, recruits, time]
            );
        } else { // mode === 'edit'
            const roleIdToEdit = parts[4];
            await db.run(
                'UPDATE rank_requirements SET required_patrol_hours = $1, required_courses = $2, required_recruits = $3, required_time_in_rank_days = $4 WHERE role_id = $5',
                [hours, courses, recruits, time, roleIdToEdit]
            );
        }

        // Responde e depois atualiza o painel de gestão para refletir a mudança
        await interaction.editReply({ content: '✅ Requisitos de promoção salvos com sucesso!' });
        const payload = await getCareerRequirementsMenuPayload(db, interaction);
        await interaction.message.edit(payload);
    }
};

module.exports = careerHandler;