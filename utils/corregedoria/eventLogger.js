const db = require('../../database/db.js');

/**
 * Registra um novo evento para um ticket da corregedoria.
 * @param {number} ticketId - O ID do ticket.
 * @param {string} eventType - O tipo do evento (ex: 'reivindicado', 'membro_adicionado').
 * @param {string} eventDescription - A descrição formatada do evento.
 * @param {string} userId - O ID do usuário que realizou a ação.
 */
async function logCorregedoriaEvent(ticketId, eventType, eventDescription, userId) {
    const createdAt = Math.floor(Date.now() / 1000);
    try {
        await db.run(
            'INSERT INTO corregedoria_events (ticket_id, event_type, event_description, user_id, created_at) VALUES ($1, $2, $3, $4, $5)',
            [ticketId, eventType, eventDescription, userId, createdAt]
        );
    } catch (error) {
        console.error("Erro ao registrar evento da corregedoria:", error);
    }
}

module.exports = { logCorregedoriaEvent };