// Local: interactions/handlers/enlistment_setup_handler.js

const { ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, EmbedBuilder, ButtonBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db.js');
const { getEnlistmentMenuPayload } = require('../../views/setup_views.js');

async function showQuizHub() {
    const quizzes = await db.all("SELECT quiz_id, title FROM enlistment_quizzes");
    const embed = new EmbedBuilder().setColor("Navy").setTitle("✍️ Hub de Gerenciamento de Provas").setDescription("Crie uma nova prova ou selecione uma existente no menu para a gerir.");
    
    const components = [
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('quiz_create_new').setLabel("Criar Nova Prova").setStyle(ButtonStyle.Success)),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_to_main_menu').setLabel("Voltar ao Setup").setStyle(ButtonStyle.Secondary))
    ];

    if (quizzes.length > 0) {
        const options = quizzes.map(q => ({ label: q.title, value: q.quiz_id.toString(), description: `ID: ${q.quiz_id}` }));
        components.unshift(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('quiz_manage_select').setPlaceholder("Selecione uma prova para gerenciar...").addOptions(options)
        ));
    } else {
        embed.addFields({ name: "Nenhuma prova criada", value: "Use o botão abaixo para criar a sua primeira prova." });
    }
    
    return { embeds: [embed], components };
}

module.exports = {
    customId: (id) => id.startsWith('enlistment_setup_'),
    showQuizHub,

    async execute(interaction) {
        const action = interaction.customId.split('_').slice(2).join('_');
        try {
            if (interaction.isButton()) {
                if (action === 'manage_quizzes') {
                    const payload = await showQuizHub();
                    return await interaction.update(payload);
                }
                const actions = {
                    'set_form_channel': { type: 'channel', dbKey: 'enlistment_form_channel_id', placeholder: 'Canal de Alistamento (Restrito)' },
                    'set_approval_channel': { type: 'channel', dbKey: 'enlistment_approval_channel_id', placeholder: 'Canal de Aprovações (Recrutadores)' },
                    'set_quiz_passed_role': { type: 'role', dbKey: 'enlistment_quiz_passed_role_id', placeholder: 'Cargo Pós-Prova' },
                    'set_recruit_role': { type: 'role', dbKey: 'enlistment_recruit_role_id', placeholder: 'Cargo de Recruta (Final)' },
                    'set_recruiter_role': { type: 'role', dbKey: 'recruiter_role_id', placeholder: 'Cargo de Recrutador (Staff)' }
                };
                if (actions[action]) {
                    const { type, dbKey, placeholder } = actions[action];
                    const builder = type === 'channel' ? new ChannelSelectMenuBuilder() : new RoleSelectMenuBuilder();
                    const menu = new ActionRowBuilder().addComponents(builder.setCustomId(dbKey).setPlaceholder(placeholder));
                    return await interaction.update({ content: 'Selecione uma opção no menu.', components: [menu], embeds: [] });
                }
            }
            if (interaction.isAnySelectMenu()) {
                await db.run(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, [interaction.customId, interaction.values[0]]);
                const payload = await getEnlistmentMenuPayload(db);
                await interaction.update(payload);
            }
        } catch (error) { console.error(`Erro no setup de alistamento:`, error); }
    },
};