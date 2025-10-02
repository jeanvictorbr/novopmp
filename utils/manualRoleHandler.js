const db = require('../database/db.js');

/**
 * Chamado quando um ou mais cargos são ADICIONADOS manualmente a um membro.
 * Cria os registos correspondentes na base de dados (certificação, condecoração, etc.).
 */
async function handleManualRoleAdd(member, addedRoles) {
    try {
        const courseRoles = await db.all('SELECT course_id, role_id FROM academy_courses');
        const medalRoles = await db.all('SELECT medal_id, role_id FROM decorations_medals');

        for (const role of addedRoles.values()) {
            const now = Math.floor(Date.now() / 1000);
            
            // Verifica se é um cargo de curso
            const courseMatch = courseRoles.find(c => c.role_id === role.id);
            if (courseMatch) {
                const existingCert = await db.get('SELECT 1 FROM user_certifications WHERE user_id = $1 AND course_id = $2', [member.id, courseMatch.course_id]);
                if (!existingCert) {
                    await db.run(
                        'INSERT INTO user_certifications (user_id, course_id, completion_date, certified_by) VALUES ($1, $2, $3, $4)',
                        [member.id, courseMatch.course_id, now, member.client.user.id]
                    );
                    console.log(`[ManualRole] Certificação em "${courseMatch.course_id}" registada para ${member.user.tag}.`);
                }
            }
            
            // Verifica se é um cargo de medalha
            const medalMatch = medalRoles.find(m => m.role_id === role.id);
            if (medalMatch) {
                const existingDecoration = await db.get('SELECT 1 FROM user_decorations WHERE user_id = $1 AND medal_id = $2', [member.id, medalMatch.medal_id]);
                if (!existingDecoration) {
                    await db.run(
                        'INSERT INTO user_decorations (user_id, medal_id, awarded_by, awarded_at, reason) VALUES ($1, $2, $3, $4, $5)',
                        [member.id, medalMatch.medal_id, member.client.user.id, now, 'Atribuição manual de cargo.']
                    );
                    console.log(`[ManualRole] Condecoração ID "${medalMatch.medal_id}" registada para ${member.user.tag}.`);
                }
            }
        }
    } catch (error) {
        console.error(`[ManualRole] Erro ao processar ADIÇÃO de cargos para ${member.user.tag}:`, error);
    }
}

/**
 * --- NOVA FUNÇÃO ---
 * Chamado quando um ou mais cargos são REMOVIDOS manualmente de um membro.
 * Apaga os registos correspondentes da base de dados.
 */
async function handleManualRoleRemove(member, removedRoles) {
    try {
        const courseRoles = await db.all('SELECT course_id, role_id FROM academy_courses');
        const medalRoles = await db.all('SELECT medal_id, role_id FROM decorations_medals');

        for (const role of removedRoles.values()) {
            // Verifica se era um cargo de curso
            const courseMatch = courseRoles.find(c => c.role_id === role.id);
            if (courseMatch) {
                await db.run(
                    'DELETE FROM user_certifications WHERE user_id = $1 AND course_id = $2',
                    [member.id, courseMatch.course_id]
                );
                console.log(`[ManualRole] Certificação "${courseMatch.course_id}" removida para ${member.user.tag}.`);
            }

            // Verifica se era um cargo de medalha
            const medalMatch = medalRoles.find(m => m.role_id === role.id);
            if (medalMatch) {
                await db.run(
                    'DELETE FROM user_decorations WHERE user_id = $1 AND medal_id = $2',
                    [member.id, medalMatch.medal_id]
                );
                console.log(`[ManualRole] Condecoração ID "${medalMatch.medal_id}" removida para ${member.user.tag}.`);
            }
        }
    } catch (error) {
        console.error(`[ManualRole] Erro ao processar REMOÇÃO de cargos para ${member.user.tag}:`, error);
    }
}


module.exports = { handleManualRoleAdd, handleManualRoleRemove };