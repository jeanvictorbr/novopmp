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
const { updateMemberTag } = require('./utils/tagUpdater.js');
const { updateAcademyPanel } = require('./utils/updateAcademyPanel.js');

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

client.commandHandlers = new Collection();
client.componentHandlers = []; // Array unificado para todos os componentes

async function startBot() {
    await initializeDatabase();
    loadHandlers(path.join(__dirname, 'commands'));
    loadHandlers(path.join(__dirname, 'interactions'));
    await registerSlashCommands();
    client.login(DISCORD_TOKEN);
}

function loadHandlers(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            loadHandlers(fullPath);
        } else if (file.name.endsWith('.js')) {
            try {
                const handler = require(fullPath);
                if (handler.data) { // É um comando de barra
                    client.commandHandlers.set(handler.data.name, handler);
                    console.log(`[INFO] Handler de Comando Carregado: ${file.name}`);
                } else if (handler.customId) { // É um componente (botão, menu, modal)
                    client.componentHandlers.push(handler);
                    console.log(`[INFO] Handler de Componente Carregado: ${file.name}`);
                }
            } catch (error) {
                console.error(`[ERRO] Falha ao carregar o handler: ${file.name}`, error);
            }
        }
    }
}

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        let handler;
        if (interaction.isChatInputCommand()) {
            handler = client.commandHandlers.get(interaction.commandName);
        } else if (interaction.isMessageComponent() || interaction.isModalSubmit() || interaction.isUserSelectMenu() || interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
            const key = interaction.customId;
            for (const componentHandler of client.componentHandlers) {
                if (typeof componentHandler.customId === 'function' && componentHandler.customId(key)) {
                    handler = componentHandler;
                    break;
                }
                if (typeof componentHandler.customId === 'string' && componentHandler.customId === key) {
                    handler = componentHandler;
                    break;
                }
            }
        }

        if (!handler) {
            return console.error(`[AVISO] Nenhum handler encontrado para a interação: ${interaction.customId || interaction.commandName}`);
        }
        
        await handler.execute(interaction);
    } catch (error) {
        console.error('Erro geral ao processar interação:', error);
        const replyPayload = { content: '❌ Houve um erro crítico!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyPayload).catch(() => {});
        } else {
            await interaction.reply(replyPayload).catch(() => {});
        }
    }
});


client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
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
    setInterval(() => updateAcademyPanel(readyClient), 60000);
    console.log('[INFO] Todos os monitores foram ativados.');
    console.log(`\n---\nLogado como ${readyClient.user.tag}\n---`);
});

async function registerSlashCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    try {
        const commandsToDeploy = [];
        client.commandHandlers.forEach(handler => {
            commandsToDeploy.push(handler.data.toJSON());
        });
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandsToDeploy });
        console.log(`[INFO] Comandos (/) registrados com sucesso.`);
    } catch (error) {
        console.error('[ERRO] Falha ao registrar comandos:', error);
    }
}

startBot();