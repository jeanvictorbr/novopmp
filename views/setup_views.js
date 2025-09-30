const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const db = require('../database/db.js');
const SETUP_EMBED_IMAGE_URL = 'https://i.imgur.com/O9Efa95.gif';
const SETUP_FOOTER_TEXT = 'PoliceFlow• Sistema de Gestão Policial 🥇';      // Texto do rodapé
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
      {
        label: 'Módulo COPOM',
        description: 'Configure canais, cargos e equipes para o controle de patrulha.',
        value: 'module_copom',
        emoji: '👮',
      },
      {
        label: 'Módulo Academia',
        description: 'Gerencie cursos, certificações e instrutores.',
        value: 'module_academy',
        emoji: '🎓',
      },
      {
        label: 'Módulo Corregedoria',
        description: 'Gerencie denúncias, investigações e sanções internas.',
        value: 'module_corregedoria',
        emoji: '⚖️',
      },
      {
        label: 'Módulo Registros',
        description: 'Gerencie a ficha de registro de cada oficial.',
        value: 'module_records',
        emoji: '📇',
      },
      {
        label: 'Módulo Carreira',
        description: 'Gerencie promoções, medalhas e a carreira dos oficiais.',
        value: 'module_decorations',
        emoji: '🏆',
      },
      {
        label: 'Módulo Hierarquia',
        description: 'Configure uma vitrine de cargos que se atualiza sozinha.',
        value: 'module_hierarchy',
        emoji: '📊',
      },
      {
        label: 'Módulo Tags Policiais',
        description: 'Gerencie os nicks e tags automáticas dos cargos.',
        value: 'module_tags',
        emoji: '🏷️',
      },
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
    
    const settings = await db.all("SELECT key, value FROM settings WHERE key IN ('academy_channel_id', 'academy_discussion_channel_id', 'academy_logs_channel_id')");
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));
    
    const embed = new EmbedBuilder()
        .setColor(0xFEEA0A)
        .setTitle('🎓 Configuração do Módulo Academia')
        .setDescription('Gerencie cursos, instrutores e certificações.')
        .setImage(SETUP_EMBED_IMAGE_URL)
        .setFields(
            { name: 'Canal de Estudos (Painel Público)', value: settingsMap.has('academy_channel_id') ? `<#${settingsMap.get('academy_channel_id')}>` : '`Não definido`', inline: false },
            { name: 'Canal de Discussões (Tópicos)', value: settingsMap.has('academy_discussion_channel_id') ? `<#${settingsMap.get('academy_discussion_channel_id')}>` : '`Não definido`', inline: false },
            { name: 'Canal de Logs da Academia', value: settingsMap.has('academy_logs_channel_id') ? `<#${settingsMap.get('academy_logs_channel_id')}>` : '`Não definido`', inline: false }
        )
        .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });
    
    if (courses.length > 0) {
        const coursesList = courses.map(c => `**${c.name}**\n\`ID: ${c.course_id}\` - Horas Mínimas: \`${c.required_hours}\``).join('\n\n');
        embed.addFields({ name: 'Cursos Atuais', value: coursesList });
    } else {
        embed.addFields({ name: 'Cursos Atuais', value: '`Nenhum curso configurado.`' });
    }
    
    const actionButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('academy_add_course').setLabel('Adicionar Curso').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('academy_edit_course').setLabel('Editar Curso').setStyle(ButtonStyle.Secondary).setDisabled(courses.length === 0),
        new ButtonBuilder().setCustomId('academy_remove_course').setLabel('Remover Curso').setStyle(ButtonStyle.Danger).setDisabled(courses.length === 0)
    );
    const certifyButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('academy_certify_official').setLabel('Certificar Oficial').setStyle(ButtonStyle.Success).setEmoji('🎖️').setDisabled(courses.length === 0)
    );
    const scheduleButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('academy_schedule_course').setLabel('Agendar Curso').setStyle(ButtonStyle.Primary).setEmoji('🗓️').setDisabled(courses.length === 0)
    );
    
    const configButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('academy_set_channel').setLabel('Definir Canal de Estudos').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('academy_set_discussion_channel').setLabel('Definir Canal de Discussões').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('academy_set_logs_channel').setLabel('Definir Canal de Logs').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('back_to_main_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
    );

    const components = [actionButtons, certifyButton, scheduleButton, configButtons];
    
    if (courses.length > 0) {
        const options = courses.map(c => ({
            label: c.name,
            description: `Requisitos: ${c.required_hours}h`,
            value: c.course_id,
        }));
        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('academy_view_details')
                .setPlaceholder('🔍 Ver detalhes de um curso...')
                .addOptions(options),
        );
        components.splice(1, 0, selectMenu);
    }
    
    return { embeds: [embed], components: components };
}

async function getCourseEnrollmentDashboardPayload(course, guild, enrollments) {
  const embed = new EmbedBuilder()
    .setColor('Green')
    .setTitle(`Dashboard de Inscrições: ${course.name}`)
    .setDescription('Aprove ou recuse os oficiais inscritos no curso.')
    .setImage(SETUP_EMBED_IMAGE_URL)
    .setFooter({ text: 'Certifique apenas os oficiais que completaram o curso.', iconURL: SETUP_FOOTER_ICON_URL });

  const options = await Promise.all(enrollments.map(async (e) => {
    const member = await guild.members.fetch(e.user_id).catch(() => null);
    if (!member) return null;
    return {
      label: member.user.username,
      description: `Inscrito em: ${new Date(e.enrollment_date * 1000).toLocaleDateString()}`,
      value: e.user_id,
    };
  }));

  const validOptions = options.filter(Boolean);

  if (validOptions.length === 0) {
    embed.setDescription('Nenhum oficial inscrito neste curso no momento.');
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`academy_certify_member_select_${course.course_id}`)
    .setPlaceholder('Selecione um oficial para certificar...')
    .addOptions(validOptions.length > 0 ? validOptions : [{ label: 'Nenhum inscrito', value: 'none', disabled: true }]);

  const approveAllButton = new ButtonBuilder()
    .setCustomId(`academy_certify_all_${course.course_id}`)
    .setLabel('Aprovar Todos')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅')
    .setDisabled(validOptions.length === 0);

  const actionRow = new ActionRowBuilder().addComponents(selectMenu);
  
  const buttonRow = new ActionRowBuilder().addComponents(
    approveAllButton,
    new ButtonBuilder().setCustomId('back_to_academy_menu').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [actionRow, buttonRow] };
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
    .setDescription('Use os botões abaixo para gerenciar a carreira dos seus oficiais, desde promoções até a concessão de medalhas por mérito.')
    .setImage(SETUP_EMBED_IMAGE_URL)
    .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL })
    .addFields({ name: 'Canal de Anúncios', value: settings ? `<#${settings.value}>` : '`Não definido`' });
  
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('decorations_promote_officer').setLabel('Promover Oficial').setStyle(ButtonStyle.Success).setEmoji('⬆️'),
    new ButtonBuilder().setCustomId('decorations_award_medal').setLabel('Condecorar Oficial').setStyle(ButtonStyle.Primary).setEmoji('🎖️'),
    new ButtonBuilder().setCustomId('decorations_manage_medals').setLabel('Gerenciar Medalhas').setStyle(ButtonStyle.Secondary).setEmoji('📜')
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('decorations_set_channel').setLabel('Definir Canal de Anúncios').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('decorations_set_promote_image').setLabel('Definir Imagem de Promoção').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('back_to_main_menu').setLabel('Voltar').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row1, row2] };
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
async function getRecordsMenuPayload(db) {
  const settings = await db.get("SELECT value FROM settings WHERE key = 'records_public_channel_id'");
  const embed = new EmbedBuilder()
    .setColor('White')
    .setTitle('📇 Configuração do Módulo de Registros')
    .setDescription('Gerencie os registros de oficiais e configure a prova teórica de ingresso.')
    .setImage(SETUP_EMBED_IMAGE_URL)
    .addFields({ name: 'Canal Público de Consulta', value: settings ? `<#${settings.value}>` : '`Não definido`' })
    .setFooter({ text: SETUP_FOOTER_TEXT, iconURL: SETUP_FOOTER_ICON_URL });
  
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('records_create_edit').setLabel('Criar / Editar Registro').setStyle(ButtonStyle.Success).setEmoji('📝'),
    new ButtonBuilder().setCustomId('records_manage_test').setLabel('Gerenciar Prova Teórica').setStyle(ButtonStyle.Primary).setEmoji('❓').setDisabled(true) // Desabilitado por enquanto
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('records_set_public_channel').setLabel('Definir Canal Público').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('back_to_main_menu').setLabel('Voltar').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row1, row2] };
}


// CORREÇÃO DEFINITIVA: Garante que TODAS as funções de payload sejam exportadas.
module.exports = {
  getMainMenuPayload,
  getCopomMenuPayload,
  getCopomTeamsMenuPayload,
  getAcademyMenuPayload,
  getCourseEnrollmentDashboardPayload,
  getCorregedoriaMenuPayload,
  getCorregedoriaPunishmentsMenuPayload,
  getDecorationsMenuPayload,
  getRecordsMenuPayload,
  getDecorationsManageMedalsPayload,
  getHierarchyMenuPayload,
  getTagsMenuPayload,
  SETUP_FOOTER_TEXT,         // <-- CONSTANTE EXPORTADA
  SETUP_FOOTER_ICON_URL      // <-- CONSTANTE EXPORTADA
};