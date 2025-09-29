const { EmbedBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType } = require('discord.js');
const db = require('../../database/db.js');
const { hierarchyMonitor } = require('../../utils/hierarchyMonitor.js');
const { getHierarchyMenuPayload } = require('../../views/setup_views.js');

// Este objeto contém toda a lógica para o módulo de hierarquia.
const hierarchyHandler = {
    // Esta função nos ajuda a identificar se a interação pertence a este handler.
    customId: (id) => id.startsWith('hierarchy_'),
    
    // O método principal que distribui a interação para a função correta.
    async execute(interaction) {
        const { customId } = interaction;

        try {
            // --- BOTÕES ---
            if (customId === 'hierarchy_deploy') return await this.deployPanel(interaction);
            if (customId === 'hierarchy_set_channel') return await this.showChannelSelect(interaction);
            if (customId === 'hierarchy_set_title') return await this.showTitleModal(interaction);
            if (customId === 'hierarchy_set_image') return await this.showImageModal(interaction);
            if (customId === 'hierarchy_manage_roles') return await this.showRoleSelect(interaction);

            // --- MENUS DE SELEÇÃO ---
            if (customId === 'hierarchy_channel_select') return await this.handleChannelSelect(interaction);
            if (customId === 'hierarchy_hide_roles_select') return await this.handleRoleSelect(interaction);

            // --- FORMULÁRIOS (MODALS) ---
            if (customId === 'hierarchy_set_title_modal') return await this.handleTitleModal(interaction);
            if (customId === 'hierarchy_set_image_modal') return await this.handleImageModal(interaction);

        } catch (error) {
            console.error(`Erro no handler de hierarquia (${customId}):`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Ocorreu um erro ao processar esta ação.', ephemeral: true }).catch(() => {});
            } else {
                await interaction.followUp({ content: '❌ Ocorreu um erro ao processar esta ação.', ephemeral: true }).catch(() => {});
            }
        }
    },

    // Funções de Ação
    async deployPanel(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const channelId = (await db.get("SELECT value FROM settings WHERE key = 'hierarchy_channel_id'"))?.value;
        if (!channelId) return interaction.editReply('❌ Você precisa definir um canal primeiro!');
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return interaction.editReply('❌ O canal configurado não foi encontrado.');
        const embed = new EmbedBuilder().setDescription('Aguardando a primeira atualização...');
        const message = await channel.send({ embeds: [embed] });
        await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['hierarchy_message_id', message.id]);
        await hierarchyMonitor(interaction.client);
        await interaction.editReply(`✅ Painel de Hierarquia implantado com sucesso em ${channel}!`);
    },

    async showChannelSelect(interaction) {
        const menu = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('hierarchy_channel_select').setPlaceholder('Selecione o canal...').addChannelTypes(ChannelType.GuildText));
        await interaction.reply({ components: [menu], ephemeral: true });
    },

    async showTitleModal(interaction) {
        const modal = new ModalBuilder().setCustomId('hierarchy_set_title_modal').setTitle('Título da Hierarquia');
        const input = new TextInputBuilder().setCustomId('h_title').setLabel("Título da Embed").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async showImageModal(interaction) {
        const modal = new ModalBuilder().setCustomId('hierarchy_set_image_modal').setTitle('Imagem da Hierarquia');
        const input = new TextInputBuilder().setCustomId('h_image').setLabel("URL da Imagem").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async showRoleSelect(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const hiddenRolesResult = await db.all('SELECT role_id FROM hierarchy_hidden_roles');
        const hiddenRoleIds = hiddenRolesResult.map(r => r.role_id);
        const menu = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('hierarchy_hide_roles_select').setPlaceholder('Selecione os cargos para ocultar...').setMinValues(0).setMaxValues(25).setDefaultRoles(hiddenRoleIds));
        await interaction.editReply({ content: 'Selecione os cargos que NÃO devem aparecer na hierarquia.', components: [menu] });
    },

    async handleChannelSelect(interaction) {
        await interaction.deferUpdate();
        await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['hierarchy_channel_id', interaction.values[0]]);
        const payload = await getHierarchyMenuPayload(db);
        await interaction.editReply(payload);
    },

    async handleRoleSelect(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const selectedRoleIds = interaction.values;
        await db.run('DELETE FROM hierarchy_hidden_roles');
        if (selectedRoleIds.length > 0) {
            const placeholders = selectedRoleIds.map((_, i) => `($${i + 1})`).join(', ');
            await db.run(`INSERT INTO hierarchy_hidden_roles (role_id) VALUES ${placeholders}`, selectedRoleIds);
        }
        await interaction.editReply({ content: '✅ Lista de cargos ocultos atualizada com sucesso!' });
    },

    async handleTitleModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const title = interaction.fields.getTextInputValue('h_title');
        await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['hierarchy_title', title]);
        await interaction.editReply('✅ Título atualizado com sucesso!');
    },

    async handleImageModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const imageUrl = interaction.fields.getTextInputValue('h_image');
        await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['hierarchy_image_url', imageUrl]);
        await interaction.editReply('✅ Imagem atualizada com sucesso!');
    }
};

module.exports = hierarchyHandler;