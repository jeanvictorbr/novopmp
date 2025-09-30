// Usaremos um mapa simples na memória para controlar o estado dos envios.
// Isto permite que múltiplos admins usem o comando ao mesmo tempo sem conflito.
const sendingJobs = new Map();
module.exports.sendingJobs = sendingJobs; // Exporta o mapa para ser usado pelo outro arquivo

const handler = {
    customId: (id) => id.startsWith('recado_control_'),
    
    async execute(interaction) {
        const [, action, jobId] = interaction.customId.split('_');
        const job = sendingJobs.get(jobId);

        if (!job) {
            return await interaction.update({ content: 'Este envio já foi concluído ou cancelado.', embeds: [], components: [] });
        }

        if (action === 'pause') {
            job.status = 'paused';
            await interaction.update({ content: '⏸️ O envio foi pausado.', components: [] });
        }

        if (action === 'continue') {
            job.status = 'running';
            await interaction.update({ content: '▶️ O envio foi retomado.', components: [] });
        }

        if (action === 'cancel') {
            job.status = 'cancelled';
            sendingJobs.delete(jobId); // Limpa o job da memória
            await interaction.update({ content: '❌ O envio foi cancelado pelo operador.', embeds: [], components: [] });
        }
    }
};

module.exports.handler = handler;