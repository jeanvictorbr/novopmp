/**
 * Converte uma string de duração (ex: "10m", "7d", "2h") para segundos.
 * @param {string} durationStr A string da duração.
 * @returns {number|null} O total de segundos, ou null se o formato for inválido.
 */
function parseDuration(durationStr) {
    if (!durationStr || typeof durationStr !== 'string') return 0;

    const match = durationStr.toLowerCase().match(/^(\d+)\s*([a-z]+)/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    if (['s', 'seg', 'segs', 'segundo', 'segundos'].includes(unit)) {
        return value;
    }
    if (['m', 'min', 'mins', 'minuto', 'minutos'].includes(unit)) {
        return value * 60;
    }
    if (['h', 'hr', 'hrs', 'hora', 'horas'].includes(unit)) {
        return value * 3600;
    }
    if (['d', 'dia', 'dias'].includes(unit)) {
        return value * 86400;
    }
    
    // Retorna nulo se a unidade for desconhecida (ex: "3x")
    return null;
}

module.exports = { parseDuration };