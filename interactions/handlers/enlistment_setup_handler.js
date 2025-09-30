// Local: interactions/handlers/enlistment_setup_handler.js

const { ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db.js');
const { getEnlistmentMenuPayload } = require('../../views/setup_views.js');

async function showQuizHub() {
    const quizzes = await db.all("SELECT quiz_id, title FROM enlistment_quizzes");
    const embed = new EmbedBuilder().setColor("Navy").setTitle("✍️ Hub de Gerenciamento de Provas").setDescription("Crie uma nova prova ou selecione uma existente no menu para a gerir.");
    
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quiz_create_new').setLabel("Criar Nova Prova").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('back_to_main_menu').setLabel("Voltar ao Setup").setStyle(ButtonStyle.Secondary)
    );

    const components = [buttons];

    if (quizzes.length > 0) {
        const options = quizzes.map(q => ({
            label: q.title,
            value: q.quiz_id.toString(),
            description: `ID: ${q.quiz_id}`
        }));
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('quiz_manage_select').setPlaceholder("Selecione uma prova para gerenciar...").addOptions(options)
        );
        components.unshift(menu); // Adiciona o menu no início
    } else {
        embed.addFields({ name: "Nenhuma prova criada", value: "Use o botão abaixo para criar a sua primeira prova." });
    }
    
    return { embeds: [embed], components };
}


module.exports = {
    customId: (id) => id.startsWith('enlistment_setup_'),
    showQuizHub, // Exportamos a função para ser usada por outros handlers, se necessário

    async execute(interaction) {
        const action = interaction.customId.split('_').slice(2).join('_');
        try {
            if (interaction.isButton()) {
                if (action === 'manage_quizzes') {
                    const payload = await showQuizHub();
                    return await interaction.update(payload);
                }

                const buttonActions = {
                    'set_quiz_channel': () => this.showChannelSelect(interaction, 'quiz_channel', 'Canal de Provas (Público)'),
                    'set_form_channel': () => this.showChannelSelect(interaction, 'form_channel', 'Canal de Alistamento (Restrito)'),
                    'set_approval_channel': () => this.showChannelSelect(interaction, 'approval_channel', 'Canal de Aprovações (Recrutadores)'),
                    'set_quiz_passed_role': () => this.showRoleSelect(interaction, 'quiz_passed_role', 'Cargo Pós-Prova'),
                    'set_recruit_role': () => this.showRoleSelect(interaction, 'recruit_role', 'Cargo de Recruta (Final)'),
                    'set_recruiter_role': () => this.showRoleSelect(interaction, 'recruiter_role', 'Cargo de Recrutador (Staff)'),
                };
                if (buttonActions[action]) return await buttonActions[action]();
            }
            if (interaction.isAnySelectMenu()) {
                await this.handleSelect(interaction);
            }
        } catch (error) { console.error(`Erro no setup de alistamento (${action}):`, error); }
    },

    async showChannelSelect(interaction, type, placeholder) {
        const customId = `enlistment_setup_${type}_select`;
        const menu = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addChannelTypes(ChannelType.GuildText));
        await interaction.update({ content: 'Selecione o canal no menu abaixo.', components: [menu], embeds: [] });
    },

    async showRoleSelect(interaction, type, placeholder) {
        const customId = `enlistment_setup_${type}_select`;
        const menu = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder));
        await interaction.update({ content: 'Selecione o cargo no menu abaixo.', components: [menu], embeds: [] });
    },

    async handleSelect(interaction) {
        const [,, type] = interaction.customId.split('_');
        const dbKey = `enlistment_${type}_id`;
        await db.run(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, [dbKey, interaction.values[0]]);
        const payload = await getEnlistmentMenuPayload(db);
        await interaction.update(payload);
    },
};