const { Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const componentHandlers = new Collection();
const functionHandlers = [];

// Função para carregar todos os handlers de componentes (botões, menus, modais)
function loadHandlers(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            loadHandlers(fullPath);
        } else if (file.name.endsWith('.js') && file.name !== 'handler.js') {
            try {
                const handler = require(fullPath);
                if (typeof handler.customId === 'function') {
                    functionHandlers.push(handler);
                } else if (handler.customId) {
                    componentHandlers.set(handler.customId, handler);
                }
            } catch (error) {
                console.error(`[HANDLER_LOAD_ERROR] Falha ao carregar ${file.name}:`, error);
            }
        }
    }
}

// O executor principal que encontra o handler correto
async function execute(interaction) {
    const key = interaction.customId;
    let handler = componentHandlers.get(key);

    // Se não achar uma correspondência exata, testa as funções
    if (!handler) {
        for (const funcHandler of functionHandlers) {
            if (funcHandler.customId(key)) {
                handler = funcHandler;
                break;
            }
        }
    }
    
    // Se ainda não achar, testa a lógica de IDs compostos (aqui está a mágica)
    if (!handler) {
        const baseKey = key.split('|')[0];
        handler = componentHandlers.get(baseKey) || functionHandlers.find(h => h.customId(baseKey));
    }

    if (!handler) {
        return console.error(`[MASTER_HANDLER] Nenhum handler encontrado para a interação: ${key}`);
    }

    await handler.execute(interaction);
}

module.exports = {
    loadHandlers,
    execute
};