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
const { handleManualRoleAdd, handleManualRoleRemove } = require('./utils/manualRoleHandler.js');
const { updateAcademyPanel } = require('./utils/updateAcademyPanel.js');
const { achievementMonitor } = require('./utils/achievement_monitor.js'); // IMPORTAÇÃO CORRIGIDA
const masterHandler = require('./interactions/handler.js');

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

client.commands = new Collection();

async function startBot() {
    await initializeDatabase();
    loadCommands(path.join(__dirname, 'commands'));
    masterHandler.loadHandlers(path.join(__dirname, 'interactions'));
    await registerSlashCommands();
    client.login(DISCORD_TOKEN);
}

function loadCommands(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(file => file.endsWith('.js'));
    for (const file of files) {
        const command = require(path.join(dir, file));
        if (command.data) {
            client.commands.set(command.data.name, command);
            console.log(`[INFO] Comando Carregado: ${file}`);
        }
    }
}

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction);
        } else {
            await masterHandler.execute(interaction);
        }
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
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    if (!oldRoles.equals(newRoles)) {
        updateMemberTag(newMember);
        const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
        if (addedRoles.size > 0) {
            handleManualRoleAdd(newMember, addedRoles);
        }
        const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));
        if (removedRoles.size > 0) {
            handleManualRoleRemove(newMember, removedRoles);
        }
    }
});

client.once(Events.ClientReady, readyClient => {
    setInterval(() => punishmentMonitor(readyClient), 20000);
    setInterval(() => patrolMonitor(readyClient), 30000);
    setInterval(() => dashboardMonitor(readyClient), 5000);
    setInterval(() => hierarchyMonitor(readyClient), 180000);
    setInterval(() => updateAcademyPanel(readyClient), 60000);
    setInterval(() => achievementMonitor(readyClient), 30000);
    console.log('[INFO] Todos os monitores foram ativados.');
    console.log(`\n---\nLogado como ${readyClient.user.tag}\n---`);
});

async function registerSlashCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    try {
        const commandsToDeploy = client.commands.map(command => command.data.toJSON());
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandsToDeploy });
        console.log(`[INFO] Comandos (/) registrados com sucesso.`);
    } catch (error) {
        console.error('[ERRO] Falha ao registrar comandos:', error);
    }
}

startBot();