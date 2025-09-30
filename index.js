const { Client, GatewayIntentBits, Collection, Events, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv-flow').config();

// IMPORTAÇÃO DOS MÓDULOS PRINCIPAIS
const { initializeDatabase } = require('./database/schema.js');
const { punishmentMonitor } = require('./utils/corregedoria/punishmentMonitor.js');
const { patrolMonitor } = require('./utils/patrolMonitor.js');
const { dashboardMonitor } = require('./utils/dashboardMonitor.js');
const { hierarchyMonitor } = require('./utils/hierarchyMonitor.js');

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

// FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO
async function startBot() {
    // 1. VERIFICA E CRIA AS TABELAS DO BANCO DE DADOS
    await initializeDatabase();

    // 2. CARREGA TODOS OS COMANDOS E INTERAÇÕES
    loadHandlers('commands');
    loadHandlers('interactions');

    // 3. REGISTRA OS COMANDOS DE BARRA NO DISCORD
    registerSlashCommands();

    // 4. FAZ O LOGIN DO BOT
    client.login(DISCORD_TOKEN);
}

// --- SISTEMA DE CARREGAMENTO DE HANDLERS ---
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

// --- O "CÉREBRO" DO BOT ---
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

        if (!handler) {
            return console.error(`[AVISO] Nenhum handler encontrado para a interação: ${key}`);
        }
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

// --- EVENTOS E MONITORES PÓS-INICIALIZAÇÃO ---
client.once(Events.ClientReady, readyClient => {
    setInterval(() => punishmentMonitor(readyClient), 20000); 
    setInterval(() => patrolMonitor(readyClient), 30000);
    setInterval(() => dashboardMonitor(readyClient), 5000); 
    setInterval(() => hierarchyMonitor(readyClient), 180000);
    console.log('[INFO] Todos os monitores foram ativados.');
    console.log(`\n---\nLogado como ${readyClient.user.tag}\n---`);
});

// --- REGISTRO DE COMANDOS ---
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
async function registerSlashCommands() {
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

// --- INICIA O BOT ---
startBot();