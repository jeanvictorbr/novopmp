// Local: interactions/handlers/enlistment_setup_handler.js

const { ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, ComponentType } = require('discord.js');
const db = require('../../database/db.js');
const { getEnlistmentMenuPayload } = require('../../views/setup_views.js');

// Este handler irá gerir todas as interações que começam com "enlistment_setup_"
module.exports = {
    customId: (id) => id.startsWith('enlistment_setup_'),

    async execute(interaction) {
        // Extrai a ação específica do customId. Ex: "set_public_channel"
        const action = interaction.customId.split('_').slice(2).join('_');

        try {
            // Se a interação for um clique de botão
            if (interaction.isButton()) {
                if (action === 'set_public_channel') {
                    return await this.showChannelSelect(interaction, 'public');
                }
                if (action === 'set_approval_channel') {
                    return await this.showChannelSelect(interaction, 'approval');
                }
                if (action === 'set_recruiter_role') {
                    return await this.showRoleSelect(interaction, 'recruiter');
                }
                if (action === 'set_recruit_role') {
                    return await this.showRoleSelect(interaction, 'recruit');
                }
            }

            // Se a interação for uma seleção de menu
            if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
                await this.handleSelect(interaction);
            }

        } catch (error) {
            console.error(`Erro no handler de setup de alistamento (${action}):`, error);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao processar esta ação.', ephemeral: true }).catch(()=>{});
        }
    },

    // Função para mostrar o menu de seleção de canal
    async showChannelSelect(interaction, type) {
        const customId = `enlistment_setup_${type}_channel_select`;
        const placeholder = type === 'public' 
            ? 'Selecione o canal para o painel público...' 
            : 'Selecione o canal para as aprovações...';
        
        const menu = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId(customId)
                .setPlaceholder(placeholder)
                .addChannelTypes(ChannelType.GuildText)
        );
        await interaction.update({ content: 'Por favor, selecione uma opção no menu abaixo.', components: [menu], embeds: [] });
    },

    // Função para mostrar o menu de seleção de cargo
    async showRoleSelect(interaction, type) {
        const customId = `enlistment_setup_${type}_role_select`;
        const placeholder = type === 'recruiter' 
            ? 'Selecione o cargo de recrutador...' 
            : 'Selecione o cargo para novos alistados...';

        const menu = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId(customId)
                .setPlaceholder(placeholder)
        );
        await interaction.update({ content: 'Por favor, selecione uma opção no menu abaixo.', components: [menu], embeds: [] });
    },

    // Função para processar a seleção e salvar no banco de dados
    async handleSelect(interaction) {
        const action = interaction.customId.split('_').slice(2).join('_');
        const selectedValue = interaction.values[0];
        
        let dbKey;
        switch(action) {
            case 'public_channel_select': dbKey = 'enlistment_public_channel_id'; break;
            case 'approval_channel_select': dbKey = 'enlistment_approval_channel_id'; break;
            case 'recruiter_role_select': dbKey = 'recruiter_role_id'; break;
            case 'recruit_role_select': dbKey = 'enlistment_recruit_role_id'; break;
            default: return; // Se a ação não for reconhecida, não faz nada
        }

        if (dbKey) {
            await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [dbKey, selectedValue]);
        }

        // Após salvar, recarrega o menu principal do módulo de alistamento
        const payload = await getEnlistmentMenuPayload(db);
        await interaction.update(payload);
    }
};