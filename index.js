// Local: index.js

const { Client, GatewayIntentBits, Collection, Events, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv-flow').config();

// IMPORTAÇÃO DOS MÓDulos PRINCIPAIS
const { initializeDatabase } = require('./database/schema.js');
const { punishmentMonitor } = require('./utils/corregedoria/punishmentMonitor.js');
const { patrolMonitor } = require('./utils/patrolMonitor.js');
const { dashboardMonitor } = require('./utils/dashboardMonitor.js');
const { hierarchyMonitor } = require('./utils/hierarchyMonitor.js');
const { updateMemberTag } = require('./utils/tagUpdater.js');
const interactionHandler = require('./interactions/handler.js'); // <-- NOSSO NOVO ROTEADOR CENTRAL

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

client.commands = new Collection(); // Usaremos isto apenas para os comandos de barra

async function startBot() {
    await initializeDatabase();
    loadSlashCommands(); // Carrega apenas os comandos de barra
    registerSlashCommands();
    client.login(DISCORD_TOKEN);
}

// Função simplificada para carregar apenas os comandos de barra
function loadSlashCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`[INFO] Comando de barra carregado: ${command.data.name}`);
        }
    }
}

// Evento de Interação Simplificado
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction);
        } else {
            // Qualquer outra interação (botão, menu, modal) é enviada para o nosso roteador central.
            await interactionHandler.execute(interaction);
        }
    } catch (error) {
        console.error('Erro geral ao processar interação:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '❌ Houve um erro crítico!', ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ Houve um erro crítico!', ephemeral: true }).catch(() => {});
        }
    }
});

client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    if (!oldMember.roles.cache.equals(newMember.roles.cache)) {
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
        const commandsToDeploy = Array.from(client.commands.values()).map(c => c.data.toJSON());
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandsToDeploy });
        console.log(`[INFO] Comandos (/) registrados com sucesso.`);
    } catch (error) {
        console.error('[ERRO] Falha ao registrar comandos:', error);
    }
}

startBot();