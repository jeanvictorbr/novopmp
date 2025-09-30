// Local: interactions/handler.js

// Importações Globais
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const db = require('../database/db.js');
const enlistmentHandler = require('./handlers/enlistment_handler.js');
const { getEnlistmentMenuPayload, getMainMenuPayload } = require('../views/setup_views.js');

// Mapa para estado das provas
const userQuizStates = new Map();

//======================================================================
// ROTEADOR PRINCIPAL - O CÉREBRO
//======================================================================
module.exports = {
    async execute(interaction) {
        const { customId } = interaction;

        // Rota para o Módulo de Alistamento (Setup)
        if (customId.startsWith('enlistment_setup_')) {
            return await handleEnlistmentSetup(interaction);
        }
        // Rota para o Módulo de Provas (Admin e Público)
        if (customId.startsWith('quiz_')) {
            return await handleQuiz(interaction);
        }
         // Rota para o Módulo de Alistamento V2
        if (enlistmentHandler.customId(customId)) {
            return await enlistmentHandler.execute(interaction);
        }
        // Rota para o Módulo de Alistamento (Público)
        if (customId.startsWith('enlistment_')) {
            return await handleEnlistmentPublic(interaction);
        }
        
        // Rota para o botão de voltar principal
        if (customId === 'back_to_main_menu') {
            const payload = await getMainMenuPayload();
            return await interaction.update(payload);
        }

        // --- ADICIONE AQUI AS ROTAS PARA OS SEUS OUTROS MÓDULOS ---
        // Exemplo:
        // if (customId.startsWith('copom_')) {
        //     const copomHandler = require('./buttons/copom_start_service.js'); // Exemplo
        //     return await copomHandler.execute(interaction);
        // }

        console.warn(`[AVISO] Nenhuma rota encontrada para a interação: ${customId}`);
    }
};


//======================================================================
// LÓGICA DO ALISTAMENTO (SETUP)
//======================================================================
async function handleEnlistmentSetup(interaction) {
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
}

async function showQuizHub() {
    const quizzes = await db.all("SELECT quiz_id, title FROM enlistment_quizzes");
    const embed = new EmbedBuilder().setColor("Navy").setTitle("✍️ Hub de Gerenciamento de Provas").setDescription("Crie uma nova prova ou selecione uma existente no menu para a gerir.");
    const components = [
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('quiz_create_new').setLabel("Criar Nova Prova").setStyle(ButtonStyle.Success)),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('enlistment_setup_manage_quizzes_back').setLabel("Voltar").setStyle(ButtonStyle.Secondary)) // Botão de voltar corrigido
    ];
    if (quizzes.length > 0) {
        const options = quizzes.map(q => ({ label: q.title, value: q.quiz_id.toString(), description: `ID: ${q.quiz_id}` }));
        components.unshift(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('quiz_manage_select').setPlaceholder("Selecione uma prova para gerenciar...").addOptions(options)));
    } else {
        embed.addFields({ name: "Nenhuma prova criada", value: "Use o botão abaixo para criar a sua primeira prova." });
    }
    return { embeds: [embed], components };
}


//======================================================================
// LÓGICA DO ALISTAMENTO (PÚBLICO)
//======================================================================
async function handleEnlistmentPublic(interaction) {
    const [action, ...args] = interaction.customId.split('_');
    try {
        if (action === 'start' && args.join('_') === 'process') return await handleStartProcess(interaction);
        if (interaction.isModalSubmit() && interaction.customId === 'enlistment_apply_modal') return await handleEnlistmentModal(interaction);
        if (action === 'approve') return await handleApproval(interaction, 'approved');
        if (action === 'reject') return await handleApproval(interaction, 'rejected');
    } catch (error) { console.error(`Erro no handler público de alistamento:`, error); }
}

async function handleStartProcess(interaction) {
    const activeQuizId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_id'"))?.value;
    if (activeQuizId) {
        const quizPassedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;
        if (!quizPassedRoleId || !interaction.member.roles.cache.has(quizPassedRoleId)) {
            return interaction.reply({ content: '❌ Você precisa primeiro ser aprovado na prova teórica para se alistar.', ephemeral: true });
        }
    }
    const existingRequest = await db.get('SELECT * FROM enlistment_requests WHERE user_id = $1 AND status = $2', [interaction.user.id, 'pending']);
    if (existingRequest) return interaction.reply({ content: `❌ Você já possui uma ficha em análise.`, ephemeral: true });

    const modal = new ModalBuilder().setCustomId('enlistment_apply_modal').setTitle('Formulário de Alistamento');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rp_name').setLabel("Nome Completo (RP)").setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('game_id').setLabel("Seu ID (no jogo)").setStyle(TextInputStyle.Short).setRequired(true))
    );
    await interaction.showModal(modal);
}

async function handleEnlistmentModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const rpName = interaction.fields.getTextInputValue('rp_name');
    const gameId = interaction.fields.getTextInputValue('game_id');
    const approvalChannelId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_approval_channel_id'"))?.value;
    const recruiterRoleId = (await db.get("SELECT value FROM settings WHERE key = 'recruiter_role_id'"))?.value;
    if (!approvalChannelId || !recruiterRoleId) return interaction.editReply({ content: '❌ O sistema está com configurações pendentes.' });

    const result = await db.run('INSERT INTO enlistment_requests (user_id, rp_name, game_id, request_date, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO UPDATE SET rp_name = $2, game_id = $3, request_date = $4, status = $5 RETURNING request_id', [interaction.user.id, rpName, gameId, Math.floor(Date.now() / 1000), 'pending']);
    const requestId = result.rows[0].request_id;
    
    const channel = await interaction.guild.channels.fetch(approvalChannelId);
    const embed = new EmbedBuilder().setColor('Yellow').setTitle('📝 Nova Ficha para Análise').setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .addFields({ name: 'Candidato', value: interaction.user.toString() }, { name: 'Nome (RP)', value: `\`${rpName}\`` }, { name: 'ID (Jogo)', value: `\`${gameId}\`` });
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`enlistment_approve_${requestId}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`enlistment_reject_${requestId}`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
    );
    await channel.send({ content: `Atenção, <@&${recruiterRoleId}>!`, embeds: [embed], components: [buttons] });
    await interaction.editReply({ content: '✅ Sua ficha foi enviada para análise! Você será notificado sobre o resultado final.', components: [] });
}

async function handleApproval(interaction, newStatus) {
    await interaction.deferUpdate();
    const requestId = interaction.customId.split('_').pop();
    const request = await db.get('SELECT * FROM enlistment_requests WHERE request_id = $1', [requestId]);
    if (!request || request.status !== 'pending') return;

    const candidate = await interaction.guild.members.fetch(request.user_id).catch(() => null);
    if (!candidate) {
        await db.run('DELETE FROM enlistment_requests WHERE request_id = $1', [requestId]);
        return interaction.editReply({ content: 'Candidato não encontrado. Ficha removida.', components: [], embeds: [] });
    }
    await db.run('UPDATE enlistment_requests SET status = $1, recruiter_id = $2 WHERE request_id = $3', [newStatus, interaction.user.id, requestId]);
    
    const quizPassedRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_passed_role_id'"))?.value;
    if (quizPassedRoleId) await candidate.roles.remove(quizPassedRoleId).catch(console.error);

    let embedDescription;
    if (newStatus === 'approved') {
        embedDescription = 'Parabéns! Sua ficha foi aprovada e você foi oficialmente recrutado.';
        const recruitRoleId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_recruit_role_id'"))?.value;
        if (recruitRoleId) await candidate.roles.add(recruitRoleId).catch(console.error);
    } else {
        embedDescription = 'Infelizmente, sua ficha foi recusada. Agradecemos o seu interesse.';
    }
    try {
        await candidate.send({ embeds: [new EmbedBuilder().setColor(newStatus === 'approved' ? 'Green' : 'Red').setTitle(newStatus === 'approved' ? '🎉 Alistamento Concluído!' : '❌ Alistamento Recusado').setDescription(embedDescription).setFooter({ text: `Analisado por: ${interaction.user.tag}` })] });
    } catch (e) {}
    
    const originalEmbed = new EmbedBuilder(interaction.message.embeds[0].toJSON()).setColor(newStatus === 'approved' ? 'Green' : 'Red').setTitle(`Ficha ${newStatus === 'approved' ? 'Aprovada' : 'Recusada'}`).setFooter({ text: `Decisão de ${interaction.user.tag}` });
    await interaction.editReply({ embeds: [originalEmbed], components: [] });
}


//======================================================================
// LÓGICA DO MÓDULO DE PROVAS
//======================================================================
async function handleQuiz(interaction) {
    // ... (cole aqui a função execute do quiz_handler da resposta anterior, mas sem a parte do 'module.exports')
}

// ... E cole aqui as funções auxiliares do quiz_handler