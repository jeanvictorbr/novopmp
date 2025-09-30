// Local: interactions/handlers/enlistment_setup_handler.js
const { ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db.js');
const { getEnlistmentMenuPayload } = require('../../views/setup_views.js');

module.exports = {
    customId: (id) => id.startsWith('enlistment_setup_'),
    async execute(interaction) {
        const action = interaction.customId.split('_').slice(2).join('_');
        try {
            if (interaction.isButton()) {
                if (action === 'set_public_channel') return await this.showChannelSelect(interaction, 'public');
                if (action === 'set_approval_channel') return await this.showChannelSelect(interaction, 'approval');
                if (action === 'set_logs_channel') return await this.showChannelSelect(interaction, 'logs');
                if (action === 'set_recruiter_role') return await this.showRoleSelect(interaction, 'recruiter');
                if (action === 'set_recruit_role') return await this.showRoleSelect(interaction, 'recruit');
                if (action === 'set_banner') return await this.showBannerModal(interaction);
                if (action === 'manage_quiz') return await this.showQuizManager(interaction);
            }
            if (interaction.isAnySelectMenu()) {
                await this.handleSelect(interaction);
            }
            if (interaction.isModalSubmit()) {
                if(interaction.customId === 'enlistment_setup_banner_modal') await this.handleBannerModal(interaction);
            }
        } catch (error) { console.error(`Erro no handler de setup de alistamento (${action}):`, error); }
    },
    async showChannelSelect(interaction, type) {
        const customId = `enlistment_setup_${type}_channel_select`;
        const menu = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(customId).addChannelTypes(ChannelType.GuildText));
        await interaction.update({ content: 'Selecione o canal no menu abaixo.', components: [menu], embeds: [] });
    },
    async showRoleSelect(interaction, type) {
        const customId = `enlistment_setup_${type}_role_select`;
        const menu = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(customId));
        await interaction.update({ content: 'Selecione o cargo no menu abaixo.', components: [menu], embeds: [] });
    },
    async showBannerModal(interaction) {
        const modal = new ModalBuilder().setCustomId('enlistment_setup_banner_modal').setTitle('Definir Imagem do Painel');
        const input = new TextInputBuilder().setCustomId('banner_url').setLabel('URL da Imagem').setStyle(TextInputStyle.Short).setPlaceholder('https://i.imgur.com/seu-banner.png').setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },
    async handleBannerModal(interaction){
        await db.run(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, ['enlistment_banner_url', interaction.fields.getTextInputValue('banner_url')]);
        const payload = await getEnlistmentMenuPayload(db);
        await interaction.update(payload);
    },
    async showQuizManager(interaction) {
        const quizzes = await db.all("SELECT quiz_id, title FROM enlistment_quizzes");
        const activeQuizId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_id'"))?.value;

        const embed = new EmbedBuilder().setTitle("✍️ Gerenciador de Prova Teórica").setDescription("Ative uma prova para que ela seja exigida dos candidatos após a aprovação do recrutador, ou desative completamente.");
        
        if(quizzes.length === 0){
            embed.addFields({name: "Nenhuma prova criada", value: "Use o comando `/alistamento criaprova` para criar uma."});
        }
        
        const options = quizzes.map(q => ({
            label: q.title,
            value: q.quiz_id.toString(),
            description: `ID da Prova: ${q.quiz_id}`,
            default: q.quiz_id.toString() === activeQuizId
        }));

        options.push({ label: "Desativar Prova Teórica", value: "disable", emoji: "❌"});

        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('enlistment_setup_quiz_select').setPlaceholder('Selecione uma prova para ativar ou desativar...').addOptions(options));
        const backButton = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('enlistment_setup_back_to_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary));
        await interaction.update({embeds: [embed], components: [menu, backButton]});
    },
    async handleSelect(interaction) {
        const action = interaction.customId.split('_').slice(2).join('_');
        const value = interaction.values[0];
        
        let dbKey;
        switch(action) {
            case 'public_channel_select': dbKey = 'enlistment_public_channel_id'; break;
            case 'approval_channel_select': dbKey = 'enlistment_approval_channel_id'; break;
            case 'logs_channel_select': dbKey = 'enlistment_logs_channel_id'; break;
            case 'recruiter_role_select': dbKey = 'recruiter_role_id'; break;
            case 'recruit_role_select': dbKey = 'enlistment_recruit_role_id'; break;
            case 'quiz_select': 
                if (value === 'disable') {
                    await db.run(`DELETE FROM settings WHERE key = 'enlistment_quiz_id'`);
                } else {
                    await db.run(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, ['enlistment_quiz_id', value]);
                }
                break;
        }

        if (dbKey) {
            await db.run(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, [dbKey, value]);
        }

        const payload = await getEnlistmentMenuPayload(db);
        await interaction.update(payload);
    }
};