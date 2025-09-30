const { Client, GatewayIntentBits, Collection, Events, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv-flow').config();
const db = require('./database/db.js');

// MONITORES E FUNÇÕES GLOBAIS
const { initializeDatabase } = require('./database/schema.js');
const { punishmentMonitor } = require('./utils/corregedoria/punishmentMonitor.js');
const { patrolMonitor } = require('./utils/patrolMonitor.js');
const { dashboardMonitor } = require('./utils/dashboardMonitor.js');
const { hierarchyMonitor } = require('./utils/hierarchyMonitor.js');
const { updateMemberTag } = require('./utils/tagUpdater.js'); // <-- IMPORTAÇÃO DA FUNÇÃO DE TAGS

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

client.handlers = new Collection();

async function startBot() {
    await initializeDatabase();
    loadHandlers('commands');
    loadHandlers('interactions');
    registerSlashCommands();
    client.login(DISCORD_TOKEN);
}

function loadHandlers(dir) {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) return;
    const files = fs.readdirSync(fullPath, { withFileTypes: true });
    for (const file of files) {
        const filePath = path.join(fullPath, file.name);
        if (file.isDirectory()) {
            loadHandlers(path.join(dir, file.name));
        } else if (file.name.endsWith('.js')) {
            const handler = require(filePath);
            const key = handler.customId || handler.data?.name || file.name;
            client.handlers.set(key, handler);
            console.log(`[INFO] Handler Carregado: ${file.name}`);
        }
    }
}

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        let handler;
        const key = interaction.isChatInputCommand() ? interaction.commandName : interaction.customId;
        for (const item of client.handlers.values()) {
            if (typeof item.customId === 'function' && item.customId(key)) {
                handler = item;
                break;
            }
        }
        if (!handler) handler = client.handlers.get(key);
        if (!handler) return console.error(`[AVISO] Nenhum handler encontrado para: ${key}`);
        await handler.execute(interaction);
    } catch (error) {
        console.error('Erro geral ao processar interação:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '❌ Houve um erro crítico!', ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ Houve um erro crítico!', ephemeral: true }).catch(() => {});
        }
    }
});

// --- NOVO EVENTO PARA ATUALIZAÇÃO DE TAGS EM TEMPO REAL ---
// Este evento é acionado sempre que um membro é atualizado (ex: recebe um novo cargo).
client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    // Compara os cargos antigos com os novos. Se forem diferentes, chama a função.
    if (!oldMember.roles.cache.equals(newMember.roles.cache)) {
        console.log(`[TAGS] Detectada mudança de cargos para ${newMember.user.tag}. Verificando tag...`);
        updateMemberTag(newMember);
    }
});

client.once(Events.ClientReady, readyClient => {
    setInterval(() => punishmentMonitor(readyClient), 20000); 
    setInterval(() => patrolMonitor(readyClient), 30000);
    setInterval(() => dashboardMonitor(readyClient), 5000); 
    setInterval(() => hierarchyMonitor(readyClient), 180000);
    console.log('[INFO] Todos os monitores foram ativados.');
    console.log(`\n---\nLogado como ${readyClient.user.tag}\n---`);
});

async function registerSlashCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    try {
        const commandsToDeploy = [];
        for (const handler of client.handlers.values()){
            if(handler.data) commandsToDeploy.push(handler.data.toJSON());
        }
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandsToDeploy });
        console.log(`[INFO] Comandos (/) registrados com sucesso.`);
    } catch (error) {
        console.error('[ERRO] Falha ao registrar comandos:', error);
    }
}

startBot();