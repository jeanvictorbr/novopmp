const { Client, GatewayIntentBits, Collection, Events, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv-flow').config();
const db = require('./database/db.js');

// MONITORES E HANDLERS
const { punishmentMonitor } = require('./utils/corregedoria/punishmentMonitor.js');
const { patrolMonitor } = require('./utils/patrolMonitor.js');
const { dashboardMonitor } = require('./utils/dashboardMonitor.js');
const { hierarchyMonitor } = require('./utils/hierarchyMonitor.js');
const hierarchyHandler = require('./interactions/handlers/hierarchy_handler.js');


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

// CARREGADOR DE COMANDOS E INTERAÇÕES
const handlers = new Collection();
function loadHandlers(dir) {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) return;
    const files = fs.readdirSync(fullPath);
    for (const file of files) {
        const filePath = path.join(fullPath, file);
        const stat = fs.lstatSync(filePath);
        if (stat.isDirectory()) {
            loadHandlers(path.join(dir, file));
        } else if (file.endsWith('.js')) {
            const handler = require(filePath);
            if ('customId' in handler || 'data' in handler) {
                const key = handler.customId || handler.data.name;
                handlers.set(typeof key === 'function' ? key.toString() : key, handler);
                console.log(`[INFO] Handler carregado: ${file}`);
            }
        }
    }
}
loadHandlers('commands');
loadHandlers('interactions'); // Carrega TUDO de 'interactions' recursivamente

// O CÉREBRO DO BOT
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        let handler;
        if (interaction.isChatInputCommand()) {
            handler = handlers.get(interaction.commandName);
        } else if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
            // Procura por um handler que corresponda ao customId
            for (const item of handlers.values()) {
                if (typeof item.customId === 'function' && item.customId(interaction.customId)) {
                    handler = item;
                    break;
                }
            }
            if (!handler) handler = handlers.get(interaction.customId);
        }

        if (!handler) {
            return console.error(`Nenhum handler encontrado para a interação: ${interaction.customId || interaction.commandName}`);
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


client.once(Events.ClientReady, readyClient => {
    setInterval(() => punishmentMonitor(readyClient), 20000); 
    console.log('[INFO] Monitor de punições da Corregedoria ativado.');
    setInterval(() => patrolMonitor(readyClient), 30000);
    console.log('[INFO] Monitor de patrulha ativado.');
    setInterval(() => dashboardMonitor(readyClient), 5000); 
    console.log('[INFO] Monitor de dashboards pessoais ativado.');
    setInterval(() => hierarchyMonitor(readyClient), 180000);
    console.log('[INFO] Monitor de hierarquia ativado.');
    console.log(`\n---\nLogado como ${readyClient.user.tag}\n---`);
});

// REGISTRO DE COMANDOS
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try {
        const commandsToDeploy = [];
        for (const handler of handlers.values()){
            if(handler.data) commandsToDeploy.push(handler.data.toJSON());
        }
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commandsToDeploy },
        );
        console.log(`[INFO] Comandos (/) registrados com sucesso.`);
    } catch (error) {
        console.error('[ERRO] Falha ao registrar comandos:', error);
    }
})();

client.login(DISCORD_TOKEN);