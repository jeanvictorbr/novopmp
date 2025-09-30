// Local: interactions/handler.js

const fs = require('fs');
const path = require('path');

// Carrega dinamicamente todos os ficheiros de interações
const interactions = new Map();
function loadInteractions(dir) {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) return;
    const files = fs.readdirSync(fullPath, { withFileTypes: true });
    for (const file of files) {
        const filePath = path.join(fullPath, file.name);
        if (file.isDirectory()) {
            loadInteractions(path.join(dir, file.name));
        } else if (file.name.endsWith('.js') && file.name !== 'handler.js') {
            try {
                const handler = require(filePath);
                // A chave pode ser uma string (ID exato) ou uma função (para IDs dinâmicos)
                const key = handler.customId; 
                interactions.set(key, handler);
            } catch (error) {
                console.error(`[AVISO] Erro ao carregar a interação ${file.name}:`, error);
            }
        }
    }
}

// Carrega todas as interações das subpastas
loadInteractions('buttons');
loadInteractions('handlers');
loadInteractions('modals');
loadInteractions('selects');
loadInteractions('select_menus');


module.exports = {
    async execute(interaction) {
        const { customId } = interaction;
        let handler;

        // Procura por um handler correspondente
        for (const [key, value] of interactions.entries()) {
            if (typeof key === 'function' && key(customId)) {
                handler = value;
                break;
            }
            if (typeof key === 'string' && key === customId) {
                handler = value;
                break;
            }
        }

        if (handler) {
            await handler.execute(interaction);
        } else {
            console.warn(`[AVISO] Nenhuma rota encontrada no handler central para a interação: ${customId}`);
            // Informa o utilizador que o botão pode não estar implementado, em vez de apenas falhar.
            if (interaction.isButton() || interaction.isAnySelectMenu()) {
               await interaction.reply({ content: "Este botão ainda não tem uma função definida.", ephemeral: true }).catch(()=>{});
            }
        }
    }
};