const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const db = require('../database/db.js');

// VARIÁVEIS GLOBAIS DE ESTILO
const SETUP_EMBED_IMAGE_URL = 'https://i.imgur.com/O9Efa95.gif';
const SETUP_FOOTER_TEXT = 'PoliceFlow• Sistema de Gestão Policial 🥇';
const SETUP_FOOTER_ICON_URL = 'https://media.tenor.com/UHQFxxKqRGgAAAAi/police-bttv.gif';


async function getMainMenuPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Painel de Configuração do Police Flow')
    .setDescription('`Selecione o módulo que você deseja configurar no menu abaixo.`')
    .setImage(SETUP_EMBED_IMAGE_URL)
    .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('setup_module_select')
    .setPlaceholder('Escolha um módulo...')
    .addOptions([
      { label: 'Módulo COPOM', description: 'Configure canais, cargos e equipes para o controle de patrulha.', value: 'module_copom', emoji: '👮' },
      { label: 'Módulo Academia', description: 'Gerencie cursos, certificações e instrutores.', value: 'module_academy', emoji: '🎓' },
      { label: 'Módulo Corregedoria', description: 'Gerencie denúncias, investigações e sanções internas.', value: 'module_corregedoria', emoji: '⚖️' },
      { label: 'Módulo Alistamento', description: 'Gerencie o painel de alistamento e o canal de aprovações.', value: 'module_enlistment', emoji: '🗂️' },
      { label: 'Módulo Carreira', description: 'Gerencie promoções, medalhas, requisitos e conquistas.', value: 'module_decorations', emoji: '🏆' },
      { label: 'Módulo Hierarquia', description: 'Configure uma vitrine de cargos que se atualiza sozinha.', value: 'module_hierarchy', emoji: '📊' },
      { label: 'Módulo Tags Policiais', description: 'Gerencie os nicks e tags automáticas dos cargos.', value: 'module_tags', emoji: '🏷️' },
    ]);
  const row = new ActionRowBuilder().addComponents(selectMenu);
  return { embeds: [embed], components: [row] };
}

async function getCopomMenuPayload(db) {
  const settings = await db.all("SELECT key, value FROM settings WHERE key LIKE 'copom_%' OR key = 'em_servico_role_id'");
  const settingsMap = new Map(settings.map(s => [s.key, s.value]));

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('👮 Configuração do Módulo COPOM')
    .setDescription('Defina os canais, cargos e equipes para a operação do COPOM.')
    .setImage(SETUP_EMBED_IMAGE_URL)
    .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL })
    .addFields(
        { name: 'Canal de Operações', value: settingsMap.has('copom_channel_id') ? `<#${settingsMap.get('copom_channel_id')}>` : '`Não definido`', inline: true },
        { name: 'Cargo "Em Serviço"', value: settingsMap.has('em_servico_role_id') ? `<@&${settingsMap.get('em_servico_role_id')}>` : '`Não definido`', inline: true },
        { name: 'Canal de Logs', value: settingsMap.has('copom_logs_channel_id') ? `<#${settingsMap.get('copom_logs_channel_id')}>` : '`Não definido`', inline: true },
        { name: 'Categoria das Equipes', value: settingsMap.has('copom_teams_category_id') ? `<#${settingsMap.get('copom_teams_category_id')}>` : '`Não definido`', inline: true },
    );
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_copom_set_op_channel').setLabel('Definir Canal de OP').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_copom_set_role').setLabel('Definir Cargo').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_copom_set_logs_channel').setLabel('Definir Canal de Logs').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_copom_set_teams_category').setLabel('Definir Categoria').setStyle(ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_copom_set_image').setLabel('Definir Imagem Principal').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_copom_set_footer').setLabel('Definir Rodapé').setStyle(ButtonStyle.Secondary),
  );
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_copom_manage_teams').setLabel('Gerenciar Equipes').setEmoji('🛡️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('back_to_main_menu').setLabel('Voltar ao Início').setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

async function getCopomTeamsMenuPayload(db) {
  const teams = await db.all('SELECT * FROM patrol_teams');
  const embed = new EmbedBuilder()
    .setColor(0x53FC5E)
    .setTitle('🛡️ Gerenciamento de Equipes do COPOM')
    .setDescription('Adicione ou remova as equipes de patrulha. O bot irá criar e deletar os canais de voz automaticamente.')
    .setImage(SETUP_EMBED_IMAGE_URL)
    .setFooter({ text: 'As equipes configuradas aqui aparecerão no dashboard de "Iniciar Serviço".', iconURL: SETUP_FOOTER_ICON_URL });
  if (teams.length > 0) {
    const teamsList = teams.map(t => `**${t.team_name}**: <#${t.channel_id}> (${t.max_slots} vagas)`).join('\n');
    embed.addFields({ name: 'Equipes Atuais', value: teamsList });
  } else {
    embed.addFields({ name: 'Equipes Atuais', value: '`Nenhuma equipe configurada.`' });
  }

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('copom_team_add').setLabel('Adicionar Equipe').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('copom_team_remove').setLabel('Remover Equipe').setStyle(ButtonStyle.Primary).setDisabled(teams.length === 0),
    new ButtonBuilder().setCustomId('back_to_copom_menu').setLabel('Voltar').setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [buttons] };
}

async function getAcademyMenuPayload(db) {
    const courses = await db.all('SELECT * FROM academy_courses');
    // --- CORREÇÃO APLICADA AQUI ---
    const settings = await db.all("SELECT key, value FROM settings WHERE key IN ('academy_channel_id', 'academy_logs_channel_id', 'academy_discussion_channel_id')");
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));
    
    const embed = new EmbedBuilder()
        .setColor(0xFEEA0A)
        .setTitle('🎓 Configuração do Módulo Academia')
        .setDescription('Gerencie cursos, instrutores e certificações.')
        .setImage(SETUP_EMBED_IMAGE_URL)
        .setFields(
            { name: 'Canal de Estudos (Painel Público)', value: settingsMap.has('academy_channel_id') ? `<#${settingsMap.get('academy_channel_id')}>` : '`Não definido`', inline: false },
            { name: 'Canal de Logs da Academia', value: settingsMap.has('academy_logs_channel_id') ? `<#${settingsMap.get('academy_logs_channel_id')}>` : '`Não definido`', inline: false },
            // Adicionado o campo de status para o canal de discussões
            { name: 'Canal de Discussões (para Tópicos)', value: settingsMap.has('academy_discussion_channel_id') ? `<#${settingsMap.get('academy_discussion_channel_id')}>` : '`❌ NÃO DEFINIDO - Obrigatório para criar cursos`', inline: false }
        )
        .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });
    
    const courseManagementButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('academy_add_course').setLabel('Adicionar Curso').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('academy_edit_course').setLabel('Editar Curso').setStyle(ButtonStyle.Secondary).setDisabled(courses.length === 0),
        new ButtonBuilder().setCustomId('academy_remove_course').setLabel('Remover Curso').setStyle(ButtonStyle.Danger).setDisabled(courses.length === 0)
    );
    
    const scheduleButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('academy_schedule_waiting_list').setLabel('Agendar p/ Lista de Espera').setStyle(ButtonStyle.Primary).setEmoji('🗓️'),
        new ButtonBuilder().setCustomId('academy_schedule_independent').setLabel('Agendar Aula Avulsa').setStyle(ButtonStyle.Primary).setEmoji('📅'),
        new ButtonBuilder().setCustomId('academy_manage_events').setLabel('Gerenciar Aulas Agendadas').setStyle(ButtonStyle.Secondary).setEmoji('🔧')
    );

    const certificationButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('academy_certify_official').setLabel('Gerenciar & Certificar Turmas').setStyle(ButtonStyle.Success).setEmoji('🎖️').setDisabled(courses.length === 0)
    );
    
    // Botões de configuração reorganizados em duas linhas para acomodar o novo botão
    const configButtons1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('academy_set_channel').setLabel('Definir Canal da Academia').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('academy_set_logs_channel').setLabel('Definir Canal de Logs').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('academy_set_discussion_channel').setLabel('Definir Canal de Discussões').setStyle(ButtonStyle.Secondary)
    );

    const configButtons2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('academy_view_discussions').setLabel('Ver Discussões de Turmas').setStyle(ButtonStyle.Primary).setEmoji('💬'),
        new ButtonBuilder().setCustomId('back_to_main_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [courseManagementButtons, scheduleButtons, certificationButtons, configButtons1, configButtons2] };
}

// --- FUNÇÃO MODIFICADA ---
async function getCourseEnrollmentDashboardPayload(db, guild, course, enrollments) {
  const embed = new EmbedBuilder()
    .setColor('Green')
    .setTitle(`Dashboard de Inscrições: ${course.name}`)
    .setImage(SETUP_EMBED_IMAGE_URL)
    .setFooter({ text: 'Aprove ou recuse os oficiais inscritos no curso.', iconURL: SETUP_FOOTER_ICON_URL });

  const components = [];
  
  if (enrollments.length > 0) {
    embed.setDescription('Gerencie individualmente os oficiais inscritos ou aprove todos de uma vez.');
    
    // Limita a exibição para no máximo 5 membros por vez para não sobrecarregar a mensagem
    for (const enrollment of enrollments.slice(0, 5)) {
        const member = await guild.members.fetch(enrollment.user_id).catch(() => null);
        if (member) {
            // Adiciona uma linha de botões para cada membro
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`academy_approve_${course.course_id}_${member.id}`).setLabel(`Aprovar ${member.displayName}`).setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`academy_reject_${course.course_id}_${member.id}`).setLabel(`Reprovar ${member.displayName}`).setStyle(ButtonStyle.Danger).setEmoji('❌')
            );
            components.push(row);
        }
    }
  } else {
    embed.setDescription('Nenhum oficial inscrito neste curso no momento.');
  }

  const generalActions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`academy_certify_all_${course.course_id}`).setLabel('Aprovar Todos os Visíveis').setStyle(ButtonStyle.Primary).setEmoji('🎖️').setDisabled(enrollments.length === 0),
    new ButtonBuilder().setCustomId('back_to_academy_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
  );
  components.push(generalActions);

  return { embeds: [embed], components: components };
}


async function getQuizHubPayload(db) {
    const quizzes = await db.all("SELECT quiz_id, title FROM enlistment_quizzes ORDER BY title ASC");
    const activeQuizId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_id'"))?.value;
    const embed = new EmbedBuilder()
        .setColor("Navy")
        .setTitle("✍️ Hub de Gestão de Provas")
        .setDescription("Crie, ative ou gira as provas teóricas do seu processo de alistamento. A prova ativa será a exigida para os novos candidatos.")
        .setImage(SETUP_EMBED_IMAGE_URL)
        .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });
    const components = [];
    if (quizzes.length > 0) {
        const options = quizzes.map(q => ({
            label: q.title,
            value: `quiz_admin_select_${q.quiz_id}`,
            description: `ID da Prova: ${q.quiz_id}`,
            emoji: q.quiz_id.toString() === activeQuizId ? '✅' : '⚫'
        }));
        options.push({
            label: 'Desativar Prova Teórica',
            value: 'quiz_admin_deactivate',
            description: 'Define o modo de alistamento como "Direto", sem prova.',
            emoji: '❌'
        });
        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('quiz_admin_select_action')
                .setPlaceholder("Selecione uma prova para ativar ou gerir...")
                .addOptions(options)
        );
        components.push(selectMenu);
    } else {
        embed.addFields({ name: "Nenhuma Prova Criada", value: "Utilize o botão abaixo para criar a sua primeira prova teórica." });
    }
    const actionButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quiz_admin_create_new').setLabel("Criar Nova Prova").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('quiz_admin_back_to_enlistment_menu').setLabel("Voltar").setStyle(ButtonStyle.Secondary)
    );
    components.push(actionButtons);
    return { embeds: [embed], components };
}

async function getCorregedoriaMenuPayload(db) {
  const settings = await db.all("SELECT key, value FROM settings WHERE key LIKE 'corregedoria_%'");
  const settingsMap = new Map(settings.map(s => [s.key, s.value]));
  const formatSetting = (key, type) => {
    if (settingsMap.has(key)) {
      const id = settingsMap.get(key);
      return `✅ Definido: ${type === 'role' ? `<@&${id}>` : `<#${id}>`}`;
    }
    return '❌ `Não definido`';
  };
  const embed = new EmbedBuilder()
    .setColor('DarkRed')
    .setTitle('⚖️ Configuração do Módulo Corregedoria')
    .setDescription('Configure os pilares do sistema de denúncias e assuntos internos.')
    .setThumbnail('https://i.imgur.com/sR32sQ8.png')
    .addFields(
        { name: '👮 Cargo de Corregedor', value: `Define quem gerencia os tickets.\n**Status:** ${formatSetting('corregedoria_role_id', 'role')}` },
        { name: '🗂️ Categoria para Tickets', value: `Onde os canais de denúncia serão criados.\n**Status:** ${formatSetting('corregedoria_tickets_category_id', 'channel')}` },
        { name: '📢 Canal de Abertura', value: `Onde membros iniciam denúncias.\n**Status:** ${formatSetting('corregedoria_public_channel_id', 'channel')}` },
        { name: '📜 Canal de Logs (Dashboards)', value: `Onde os dashboards de cada caso são postados.\n**Status:** ${formatSetting('corregedoria_logs_channel_id', 'channel')}` },
        { name: '📄 Canal de Transcripts', value: `Onde os arquivos de texto das conversas são salvos.\n**Status:** ${formatSetting('corregedoria_transcript_channel_id', 'channel')}` }
    )
    .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_corregedoria_set_role').setLabel('Definir Cargo').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_corregedoria_set_category').setLabel('Definir Categoria').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_corregedoria_set_public').setLabel('Definir Canal de Abertura').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_corregedoria_set_logs').setLabel('Definir Canal de Logs').setStyle(ButtonStyle.Secondary)
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_corregedoria_set_transcript').setLabel('Definir Canal de Transcripts').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_corregedoria_manage_punishments').setLabel('Gerenciar Punições').setStyle(ButtonStyle.Primary).setEmoji('📜')
  );
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('corregedoria_direct_sanction').setLabel('Aplicar Sanção Direta').setStyle(ButtonStyle.Primary).setEmoji('⚖️'),
    new ButtonBuilder().setCustomId('back_to_main_menu').setLabel('Voltar ao Início').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

async function getCorregedoriaPunishmentsMenuPayload(db) {
    const punishments = await db.all('SELECT * FROM corregedoria_punishments ORDER BY name ASC');
    const embed = new EmbedBuilder()
        .setColor('DarkRed')
        .setTitle('📜 Gerenciamento de Punições Pré-definidas')
        .setDescription('Adicione, remova ou edite as sanções que podem ser aplicadas nos tickets. Estas opções aparecerão no menu de seleção ao aplicar uma punição.')
        .setImage(SETUP_EMBED_IMAGE_URL)
        .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });
    if (punishments.length > 0) {
        const punishmentList = punishments.map(p => `**- ${p.name}:** *${p.description}*`).join('\n');
        embed.addFields({ name: 'Punições Atuais', value: punishmentList });
    } else {
        embed.addFields({ name: 'Punições Atuais', value: '`Nenhuma punição pré-definida foi adicionada ainda.`' });
    }
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('corregedoria_add_punishment').setLabel('Adicionar Punição').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('corregedoria_edit_punishment').setLabel('Editar Punição').setStyle(ButtonStyle.Primary).setDisabled(punishments.length === 0),
        new ButtonBuilder().setCustomId('corregedoria_remove_punishment').setLabel('Remover Punição').setStyle(ButtonStyle.Danger).setDisabled(punishments.length === 0),
        new ButtonBuilder().setCustomId('back_to_corregedoria_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [buttons] };
}

async function getDecorationsMenuPayload(db) {
  const settings = await db.get("SELECT value FROM settings WHERE key = 'decorations_channel_id'");
  const embed = new EmbedBuilder()
    .setColor('Gold')
    .setTitle('🏆 Módulo Carreira e Condecorações')
    .setDescription('Use os botões abaixo para gerenciar a carreira dos seus oficiais, desde promoções, medalhas, requisitos e conquistas por mérito.')
    .setImage(SETUP_EMBED_IMAGE_URL)
    .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL })
    .addFields({ name: 'Canal de Anúncios', value: settings ? `<#${settings.value}>` : '`Não definido`' });
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('decorations_promote_officer').setLabel('Promover Oficial').setStyle(ButtonStyle.Success).setEmoji('⬆️'),
    new ButtonBuilder().setCustomId('decorations_award_medal').setLabel('Condecorar Oficial').setStyle(ButtonStyle.Primary).setEmoji('🎖️'),
    new ButtonBuilder().setCustomId('decorations_manage_medals').setLabel('Gerenciar Medalhas').setStyle(ButtonStyle.Secondary).setEmoji('📜')
  );
  const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('career_manage_requirements').setLabel('Gerir Requisitos').setStyle(ButtonStyle.Primary).setEmoji('📈'),
      new ButtonBuilder().setCustomId('career_manage_achievements').setLabel('Gerir Conquistas').setStyle(ButtonStyle.Primary).setEmoji('🏅')
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('decorations_set_channel').setLabel('Definir Canal de Anúncios').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('decorations_set_promote_image').setLabel('Definir Imagem de Promoção').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('back_to_main_menu').setLabel('Voltar').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row1, row2, row3] };
}

async function getDecorationsManageMedalsPayload(db) {
    const medals = await db.all("SELECT emoji, name, description FROM decorations_medals ORDER BY name ASC");
    const embed = new EmbedBuilder()
        .setColor('Aqua')
        .setTitle('📜 Gerenciamento de Medalhas')
        .setImage(SETUP_EMBED_IMAGE_URL)
        .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL })
        .setDescription('`Crie ou remova as medalhas que podem ser concedidas aos oficiais.`');
    if (medals.length > 0) {
        const medalList = medals.map(m => `${m.emoji || '🎖️'} **${m.name}**: *${m.description}*`).join('\n');
        embed.addFields({ name: 'Medalhas Existentes', value: medalList });
    } else {
        embed.addFields({ name: 'Medalhas Existentes', value: '`Nenhuma medalha criada ainda.`' });
    }
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('decorations_add_medal').setLabel('Criar Nova Medalha').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('decorations_remove_medal').setLabel('Remover Medalha').setStyle(ButtonStyle.Danger).setDisabled(medals.length === 0),
        new ButtonBuilder().setCustomId('back_to_decorations_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [buttons] };
}

async function getHierarchyMenuPayload(db) {
  const settings = await db.all("SELECT key, value FROM settings WHERE key LIKE 'hierarchy_%'");
  const settingsMap = new Map(settings.map(s => [s.key, s.value]));
  const embed = new EmbedBuilder()
    .setColor('Blue').setTitle('📊 Configuração do Módulo Hierarquia')
    .setDescription('Gerencie a vitrine de cargos auto-atualizável.')
    .setImage(SETUP_EMBED_IMAGE_URL)
    .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL })
    .addFields(
        { name: 'Canal da Vitrine', value: settingsMap.has('hierarchy_channel_id') ? `<#${settingsMap.get('hierarchy_channel_id')}>` : '`Não definido`' },
        { name: 'Título', value: settingsMap.has('hierarchy_title') ? `\`${settingsMap.get('hierarchy_title')}\`` : '`Padrão`' },
        { name: 'Imagem', value: settingsMap.has('hierarchy_image_url') ? `[Link](${settingsMap.get('hierarchy_image_url')})` : '`Nenhuma`' },
    );
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hierarchy_deploy').setLabel('Implantar / Atualizar Painel').setStyle(ButtonStyle.Success).setEmoji('🚀'),
    new ButtonBuilder().setCustomId('hierarchy_manage_roles').setLabel('Ocultar/Exibir Cargos').setStyle(ButtonStyle.Primary).setEmoji('👁️')
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hierarchy_set_channel').setLabel('Definir Canal').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('hierarchy_set_title').setLabel('Definir Título').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('hierarchy_set_image').setLabel('Definir Imagem').setStyle(ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('back_to_main_menu').setLabel('Voltar').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row1, row2, row3] };
}

async function getTagsMenuPayload(db, guild) {
  const tags = await db.all('SELECT role_id, tag FROM role_tags');
  const embed = new EmbedBuilder()
    .setColor('Greyple')
    .setTitle('🏷️ Configuração do Módulo de Tags')
    .setDescription('Configure as tags que serão aplicadas automaticamente aos nicknames dos membros com base em seus cargos. O bot sempre aplicará a tag do cargo mais alto.')
    .setImage(SETUP_EMBED_IMAGE_URL)
    .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });
  if (tags.length > 0) {
    let tagList = '';
    for (const t of tags) {
        const role = guild.roles.cache.get(t.role_id);
        tagList += `\`[${t.tag}]\` - ${role ? role.name : 'Cargo não encontrado'}\n`;
    }
    embed.addFields({ name: 'Tags Configuradas', value: tagList });
  } else {
    embed.addFields({ name: 'Tags Configuradas', value: '`Nenhuma tag configurada ainda.`' });
  }
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tags_add_edit').setLabel('Adicionar / Editar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tags_remove').setLabel('Remover').setStyle(ButtonStyle.Danger).setDisabled(tags.length === 0),
    new ButtonBuilder().setCustomId('back_to_main_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
  );
  const syncButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tags_sync_all').setLabel('Sincronizar Todos').setStyle(ButtonStyle.Primary).setEmoji('🔄')
  );
  return { embeds: [embed], components: [buttons, syncButton] };
}

async function getEnlistmentMenuPayload(db) {
    const settings = await db.all("SELECT key, value FROM settings WHERE key LIKE 'enlistment_%' OR key = 'recruiter_role_id'");
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));
    const activeQuizId = settingsMap.get('enlistment_quiz_id');
    let activeQuiz = null;
    if (activeQuizId && /^\d{1,5}$/.test(activeQuizId)) {
        try {
            activeQuiz = await db.get('SELECT title FROM enlistment_quizzes WHERE quiz_id = $1', [activeQuizId]);
        } catch (e) {
            console.error("Erro ao buscar a prova ativa (ID: " + activeQuizId + "):", e);
            activeQuiz = null;
        }
    }
    const embed = new EmbedBuilder().setColor('White').setTitle('🗂️ Configuração do Módulo de Alistamento').setDescription('Configure os canais e cargos para o processo de recrutamento.').setImage(SETUP_EMBED_IMAGE_URL).setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL })
        .addFields(
            { name: 'Prova Teórica Ativa (Opcional)', value: activeQuiz ? `✅ \`${activeQuiz.title}\`` : '`❌ Desativada`', inline: false },
            { name: 'Cargo Pós-Prova (se ativa)', value: settingsMap.has('enlistment_quiz_passed_role_id') ? `✅ <@&${settingsMap.get('enlistment_quiz_passed_role_id')}>` : '`⚠️ Não definido`', inline: true },
            { name: 'Canal de Alistamento', value: settingsMap.has('enlistment_form_channel_id') ? `✅ <#${settingsMap.get('enlistment_form_channel_id')}>` : '`❌ Não definido`', inline: true },
            { name: 'Canal de Aprovações', value: settingsMap.has('enlistment_approval_channel_id') ? `✅ <#${settingsMap.get('enlistment_approval_channel_id')}>` : '`❌ Não definido`', inline: true },
            { name: 'Cargo de Recruta (Final)', value: settingsMap.has('enlistment_recruit_role_id') ? `✅ <@&${settingsMap.get('enlistment_recruit_role_id')}>` : '`❌ Não definido`', inline: true },
            { name: 'Cargo de Recrutador (Staff)', value: settingsMap.has('recruiter_role_id') ? `✅ <@&${settingsMap.get('recruiter_role_id')}>` : '`❌ Não definido`', inline: true },
            { name: 'Canal de Logs das Provas', value: settingsMap.has('enlistment_quiz_logs_channel_id') ? `✅ <#${settingsMap.get('enlistment_quiz_logs_channel_id')}>` : '`❌ Não definido`', inline: false }
        );
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('enlistment_setup_set_form_channel').setLabel('Canal Alistamento').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('enlistment_setup_set_approval_channel').setLabel('Canal Aprovações').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('enlistment_setup_set_recruiter_role').setLabel('Cargo Recrutador').setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('enlistment_setup_set_quiz_passed_role').setLabel('Cargo Pós-Prova').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('enlistment_setup_set_recruit_role').setLabel('Cargo Recruta').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('enlistment_setup_set_quiz_logs_channel').setLabel('Logs das Provas').setStyle(ButtonStyle.Secondary)
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('enlistment_setup_manage_quizzes').setLabel('Ativar e Gerir Provas').setStyle(ButtonStyle.Primary).setEmoji('✍️'),
        new ButtonBuilder().setCustomId('back_to_main_menu').setLabel('Voltar').setStyle(ButtonStyle.Danger)
    );
    return { embeds: [embed], components: [row1, row2, row3] };
}

async function getQuizManagementPayload(db, quizId) {
    const quiz = await db.get('SELECT * FROM enlistment_quizzes WHERE quiz_id = $1', [quizId]);
    if (!quiz) {
        return {
            embeds: [new EmbedBuilder().setColor("Red").setTitle("Erro").setDescription("Esta prova não foi encontrada.")],
            components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('enlistment_setup_manage_quizzes').setLabel("Voltar ao Hub de Provas").setStyle(ButtonStyle.Primary))]
        };
    }
    let questions;
    try {
        questions = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;
        if (!Array.isArray(questions)) questions = [];
    } catch (e) {
        questions = [];
    }
    const activeQuizId = (await db.get("SELECT value FROM settings WHERE key = 'enlistment_quiz_id'"))?.value;
    const isActive = quiz.quiz_id.toString() === activeQuizId;
    const embed = new EmbedBuilder()
        .setColor(isActive ? "Green" : "Blue")
        .setTitle(`🛠️ Gerindo a Prova: ${quiz.title}`)
        .setDescription(`**ID da Prova:** \`${quiz.quiz_id}\` | **Nota Mínima:** \`${quiz.passing_score}%\` | **Status:** ${isActive ? '✅ Ativa' : '⚫ Inativa'}`)
        .setFooter({ text: "Use os botões abaixo para gerir as perguntas desta prova." });
    if (questions.length > 0) {
        let questionsText = '';
        questions.forEach((q, index) => {
            questionsText += `**${index + 1}. ${q.question}**\n*Resposta Correta: ${q.correct}*\n\n`;
        });
        embed.addFields({ name: 'Perguntas Atuais', value: questionsText });
    } else {
        embed.addFields({ name: 'Nenhuma Pergunta Adicionada', value: 'Use o botão "Adicionar Pergunta" para começar a montar a prova.' });
    }
    const components = [];
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`quiz_admin_add_question_${quiz.quiz_id}`).setLabel("Adicionar Pergunta").setStyle(ButtonStyle.Success).setEmoji('➕'),
        new ButtonBuilder().setCustomId(`quiz_admin_edit_question_${quiz.quiz_id}`).setLabel("Editar/Apagar Pergunta").setStyle(ButtonStyle.Secondary).setEmoji('✏️').setDisabled(questions.length === 0),
    );
    components.push(row1);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`quiz_admin_activate_${quiz.quiz_id}`).setLabel("Ativar Prova").setStyle(ButtonStyle.Primary).setEmoji('✅').setDisabled(isActive),
        new ButtonBuilder().setCustomId(`quiz_admin_delete_quiz_${quiz.quiz_id}`).setLabel("Apagar Prova").setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
        new ButtonBuilder().setCustomId('enlistment_setup_manage_quizzes').setLabel("Voltar ao Hub").setStyle(ButtonStyle.Secondary),
    );
    components.push(row2);
    return { embeds: [embed], components };
}

async function getCareerRequirementsMenuPayload(db, interaction) { 
    const requirements = await db.all('SELECT * FROM rank_requirements');
    const embed = new EmbedBuilder()
        .setColor('Aqua')
        .setTitle('📈 Gestão de Requisitos de Promoção')
        .setDescription('Configure as etapas e os requisitos necessários para a progressão de carreira dos oficiais.')
        .setImage(SETUP_EMBED_IMAGE_URL)
        .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });

    if (requirements.length > 0) {
        const fields = [];
        for (const req of requirements) {
            const prevRole = interaction.guild.roles.cache.get(req.previous_role_id);
            const newRole = interaction.guild.roles.cache.get(req.role_id);

            const prevRoleName = prevRole ? prevRole.name : 'Cargo Apagado';
            const newRoleName = newRole ? newRole.name : 'Cargo Apagado';
            
            const valueString = `> **Horas:** \`${req.required_patrol_hours}\`\n` +
                              `> **Cursos:** \`${req.required_courses}\`\n` +
                              `> **Recrutas:** \`${req.required_recruits}\`\n` +
                              `> **Dias no Cargo:** \`${req.required_time_in_rank_days}\``;
            
            fields.push({
                name: `De \`${prevRoleName}\` Para \`${newRoleName}\``,
                value: valueString,
                inline: false
            });
        }
        embed.addFields(fields);
    } else {
        embed.addFields({ name: 'Progressões Configuradas', value: '`Nenhuma etapa de carreira foi configurada ainda.`' });
    }

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('career_add_step').setLabel('Adicionar Etapa').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('career_edit_step').setLabel('Editar Etapa').setStyle(ButtonStyle.Primary).setDisabled(requirements.length === 0),
        new ButtonBuilder().setCustomId('career_remove_step').setLabel('Remover Etapa').setStyle(ButtonStyle.Danger).setDisabled(requirements.length === 0),
        new ButtonBuilder().setCustomId('back_to_decorations_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [buttons] };
}

async function getAchievementsMenuPayload(db) {
    // Centraliza as definições para garantir consistência
    const achievementTypes = {
        'patrol_hours': { name: 'Horas de Patrulha', unit: 'Horas' },
        'recruits': { name: 'Recrutas Aprovados', unit: 'Recrutas' },
        'courses': { name: 'Cursos Concluídos', unit: 'Cursos' }
    };

    const achievements = await db.all('SELECT * FROM achievements ORDER BY type, requirement ASC');
    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle('🏅 Gestão de Conquistas')
        .setDescription('Crie ou remova as conquistas que os oficiais podem desbloquear automaticamente ao atingir certos marcos na carreira.')
        .setImage(SETUP_EMBED_IMAGE_URL)
        .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });

    if (achievements.length > 0) {
        const achievementsByType = achievements.reduce((acc, ach) => {
            const typeName = achievementTypes[ach.type]?.name || ach.type;
            if (!acc[typeName]) {
                acc[typeName] = [];
            }
            const unit = achievementTypes[ach.type]?.unit || '';
            acc[typeName].push(`> **${ach.name}** - Requisito: \`${ach.requirement} ${unit}\``);
            return acc;
        }, {});

        for (const typeName in achievementsByType) {
            embed.addFields({ name: `Tipo: ${typeName}`, value: achievementsByType[typeName].join('\n') });
        }
    } else {
        embed.addFields({ name: 'Conquistas Configuradas', value: '`Nenhuma conquista foi criada ainda.`' });
    }

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('achievements_add').setLabel('Adicionar Conquista').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('achievements_remove').setLabel('Remover Conquista').setStyle(ButtonStyle.Danger).setDisabled(achievements.length === 0),
        new ButtonBuilder().setCustomId('back_to_decorations_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [buttons] };
}


module.exports = {
  getMainMenuPayload,
  getCopomMenuPayload,
  getCopomTeamsMenuPayload,
  getAcademyMenuPayload,
  getCourseEnrollmentDashboardPayload,
  getCorregedoriaMenuPayload,
  getCorregedoriaPunishmentsMenuPayload,
  getDecorationsMenuPayload,
  getDecorationsManageMedalsPayload,
  getHierarchyMenuPayload,
  getTagsMenuPayload,
  getEnlistmentMenuPayload,
  getQuizHubPayload,
  getQuizManagementPayload,
  getCareerRequirementsMenuPayload,
  getAchievementsMenuPayload,
  SETUP_EMBED_IMAGE_URL,
  SETUP_FOOTER_TEXT,
  SETUP_FOOTER_ICON_URL,
};