const db = require('../database/db.js');

async function handleManualRoleAdd(member) {
    try {
        // Busca todos os cargos de "carreira", cursos e medalhas de uma só vez
        const careerRoles = await db.all('SELECT role_id, previous_role_id FROM rank_requirements');
        const careerRoleIds = new Set([...careerRoles.map(r => r.role_id), ...careerRoles.map(r => r.previous_role_id)]);
        const courseRoles = await db.all('SELECT course_id, role_id FROM academy_courses');
        const medalRoles = await db.all('SELECT medal_id, role_id FROM decorations_medals');

        for (const role of member.roles.cache.values()) {
            const now = Math.floor(Date.now() / 1000);
            
            // --- NOVA LÓGICA PARA CARREIRA ---
            // Verifica se o cargo adicionado faz parte do sistema de carreira
            if (careerRoleIds.has(role.id)) {
                const existingPromo = await db.get('SELECT 1 FROM rank_history WHERE user_id = $1 AND role_id = $2', [member.id, role.id]);
                if (!existingPromo) {
                    await db.run(
                        'INSERT INTO rank_history (user_id, role_id, promoted_at, promoted_by) VALUES ($1, $2, $3, $4)',
                        [member.id, role.id, now, member.client.user.id] // Atribui ao próprio bot como "promotor"
                    );
                    console.log(`[ManualRole] Promoção para o cargo "${role.name}" registada para ${member.user.tag}.`);
                }
            }
            
            // Verifica se é um cargo de curso
            const courseMatch = courseRoles.find(c => c.role_id === role.id);
            if (courseMatch) {
                const existingCert = await db.get('SELECT 1 FROM user_certifications WHERE user_id = $1 AND course_id = $2', [member.id, courseMatch.course_id]);
                if (!existingCert) {
                    await db.run('INSERT INTO user_certifications (user_id, course_id, completion_date, certified_by) VALUES ($1, $2, $3, $4)', [member.id, courseMatch.course_id, now, member.client.user.id]);
                    console.log(`[ManualRole] Certificação em "${courseMatch.course_id}" registada para ${member.user.tag}.`);
                }
            }
            
            // Verifica se é um cargo de medalha
            const medalMatch = medalRoles.find(m => m.role_id === role.id);
            if (medalMatch) {
                const existingDecoration = await db.get('SELECT 1 FROM user_decorations WHERE user_id = $1 AND medal_id = $2', [member.id, medalMatch.medal_id]);
                if (!existingDecoration) {
                    await db.run('INSERT INTO user_decorations (user_id, medal_id, awarded_by, awarded_at, reason) VALUES ($1, $2, $3, $4, $5)', [member.id, medalMatch.medal_id, member.client.user.id, now, 'Atribuição manual de cargo.']);
                    console.log(`[ManualRole] Condecoração ID "${medalMatch.medal_id}" registada para ${member.user.tag}.`);
                }
            }
        }

    } catch (error) {
        console.error(`[ManualRole] Erro ao processar cargos para ${member.user.tag}:`, error);
    }
}

module.exports = { handleManualRoleAdd };