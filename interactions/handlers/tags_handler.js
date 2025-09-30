const { RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { getTagsMenuPayload } = require('../../views/setup_views.js');

const tagsHandler = {
    customId: (id) => id.startsWith('tags_'),
    
    async execute(interaction) {
        const { customId } = interaction;
        try {
            if (customId === 'tags_add_edit') return await this.showRoleSelect(interaction);
            if (customId === 'tags_remove') return await this.showRemoveSelect(interaction);
            if (customId === 'tags_role_select') return await this.showTagModal(interaction);
            if (customId.startsWith('tags_set_tag_modal')) return await this.handleSetTag(interaction); // Corrigido para .startsWith
            if (customId === 'tags_remove_select') return await this.handleRemoveTag(interaction);
        } catch (error) {
            console.error(`Erro no handler de tags (${customId}):`, error);
        }
    },

    async showRoleSelect(interaction) {
        const menu = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('tags_role_select').setPlaceholder('Selecione um cargo para configurar a tag...'));
        await interaction.reply({ content: 'Selecione o cargo que receberá uma tag. Se o cargo já tiver uma, você poderá editá-la.', components: [menu], ephemeral: true });
    },

    async showRemoveSelect(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const tags = await db.all('SELECT role_id, tag FROM role_tags');
        if (tags.length === 0) {
            return await interaction.editReply({ content: 'Não há tags configuradas para remover.', components: [] });
        }

        const options = await Promise.all(tags.map(async t => {
            const role = await interaction.guild.roles.fetch(t.role_id).catch(() => null);
            return {
                label: `[${t.tag}] - ${role ? role.name : 'Cargo não encontrado'}`,
                description: `ID do Cargo: ${t.role_id}`,
                value: t.role_id,
            };
        }));

        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('tags_remove_select').setPlaceholder('Selecione a configuração de tag a ser removida...').addOptions(options));
        await interaction.editReply({ content: 'Selecione a configuração de tag que deseja remover.', components: [menu] });
    },

    async showTagModal(interaction) {
        const roleId = interaction.values[0];
        const role = await interaction.guild.roles.fetch(roleId);
        const existingTag = await db.get('SELECT tag FROM role_tags WHERE role_id = $1', [roleId]);
        
        const modal = new ModalBuilder().setCustomId(`tags_set_tag_modal_${roleId}`).setTitle(`Definir Tag para @${role.name}`);
        const input = new TextInputBuilder().setCustomId('tag_input').setLabel("Tag (sem colchetes)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: SGT, TEN, CAP');
        if (existingTag) {
            input.setValue(existingTag.tag);
        }
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleSetTag(interaction) {
        // CORREÇÃO: Responde à interação do modal de forma correta.
        await interaction.deferReply({ ephemeral: true });
        const roleId = interaction.customId.split('_').pop();
        const tag = interaction.fields.getTextInputValue('tag_input').trim();

        await db.run('INSERT INTO role_tags (role_id, tag) VALUES ($1, $2) ON CONFLICT (role_id) DO UPDATE SET tag = $2', [roleId, tag]);
        
        // Apenas confirma o sucesso, não tenta editar o painel anterior.
        await interaction.editReply({ content: '✅ Tag configurada com sucesso! O painel será atualizado quando você voltar a ele.'});
    },

    async handleRemoveTag(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const roleId = interaction.values[0];
        await db.run('DELETE FROM role_tags WHERE role_id = $1', [roleId]);
        await interaction.editReply({ content: '✅ Tag removida com sucesso! O painel será atualizado quando você voltar a ele.', components: []});
    }
};

module.exports = tagsHandler;