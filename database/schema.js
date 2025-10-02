// Local: database/schema.js

const db = require('./db.js');

// Este é o "mapa" completo de todas as tabelas que o bot precisa para funcionar.
const schemaSQL = `
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    CREATE TABLE IF NOT EXISTS panels (
        panel_type TEXT PRIMARY KEY,
        channel_id VARCHAR(255),
        message_id VARCHAR(255)
    );
    CREATE TABLE IF NOT EXISTS patrol_teams (
        channel_id VARCHAR(255) PRIMARY KEY,
        team_name TEXT NOT NULL,
        max_slots INTEGER DEFAULT 4
    );
    CREATE TABLE IF NOT EXISTS patrol_sessions (
        user_id VARCHAR(255) PRIMARY KEY,
        start_time BIGINT NOT NULL,
        team_channel_id VARCHAR(255),
        log_message_id VARCHAR(255),
        dashboard_message_id VARCHAR(255),
        dashboard_channel_id VARCHAR(255),
        private_channel_id VARCHAR(255),
        status TEXT DEFAULT 'active',
        last_pause_start_time BIGINT,
        total_pause_duration INTEGER DEFAULT 0,
        warning_sent_at BIGINT
    );
    CREATE TABLE IF NOT EXISTS patrol_history (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        start_time BIGINT NOT NULL,
        end_time BIGINT NOT NULL,
        duration_seconds INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS academy_courses (
        course_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        required_hours INTEGER DEFAULT 0,
        role_id VARCHAR(255),
        thread_id VARCHAR(255)
    );
    CREATE TABLE IF NOT EXISTS academy_enrollments (
        user_id VARCHAR(255) NOT NULL,
        course_id TEXT NOT NULL,
        enrollment_date BIGINT,
        PRIMARY KEY (user_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS user_certifications (
        user_id VARCHAR(255) NOT NULL,
        course_id TEXT NOT NULL,
        completion_date BIGINT,
        certified_by VARCHAR(255),
        PRIMARY KEY (user_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS corregedoria_tickets (
        ticket_id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255),
        channel_id VARCHAR(255) UNIQUE,
        complainant_id VARCHAR(255),
        accused_info TEXT,
        description TEXT,
        evidence TEXT,
        created_at BIGINT,
        status TEXT DEFAULT 'aberto',
        closed_at BIGINT,
        closed_by VARCHAR(255),
        transcript_message_url TEXT,
        investigator_id VARCHAR(255),
        log_message_id VARCHAR(255)
    );
    CREATE TABLE IF NOT EXISTS corregedoria_punishments (
        name TEXT PRIMARY KEY,
        description TEXT,
        role_id VARCHAR(255),
        duration_seconds INTEGER
    );
    CREATE TABLE IF NOT EXISTS corregedoria_sanctions (
        sanction_id SERIAL PRIMARY KEY,
        ticket_id INTEGER,
        sanctioned_user_id VARCHAR(255),
        sanction_type TEXT,
        reason TEXT,
        applied_by VARCHAR(255),
        applied_at BIGINT,
        log_channel_id VARCHAR(255),
        log_message_id VARCHAR(255)
    );
    CREATE TABLE IF NOT EXISTS active_punishments (
        sanction_id INTEGER PRIMARY KEY,
        user_id VARCHAR(255),
        guild_id VARCHAR(255),
        role_id VARCHAR(255),
        expires_at BIGINT
    );
    CREATE TABLE IF NOT EXISTS corregedoria_events (
        event_id SERIAL PRIMARY KEY,
        ticket_id INTEGER,
        event_type TEXT,
        event_description TEXT,
        user_id VARCHAR(255),
        created_at BIGINT
    );
    CREATE TABLE IF NOT EXISTS decorations_medals (
        medal_id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        emoji VARCHAR(255),
        role_id VARCHAR(255) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_decorations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        medal_id INTEGER REFERENCES decorations_medals(medal_id) ON DELETE CASCADE,
        awarded_by VARCHAR(255) NOT NULL,
        awarded_at BIGINT NOT NULL,
        reason TEXT
    );
    CREATE TABLE IF NOT EXISTS hierarchy_hidden_roles (
        role_id VARCHAR(255) PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS role_tags (
        role_id VARCHAR(255) PRIMARY KEY,
        tag TEXT NOT NULL
    );

    -- TABELAS DO MÓDULO DE ALISTAMENTO (VERSÃO FINAL) --
    CREATE TABLE IF NOT EXISTS enlistment_requests (
        request_id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL UNIQUE,
        rp_name TEXT NOT NULL,
        game_id TEXT,
        recruiter_id VARCHAR(255),      -- Quem indicou/recrutou
        approver_id VARCHAR(255),       -- Quem clicou em aprovar/reprovar
        status TEXT DEFAULT 'pending',  -- pending, approved, rejected
        request_date BIGINT,
        log_message_id VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS enlistment_quizzes (
        quiz_id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        questions JSONB NOT NULL,
        passing_score INTEGER DEFAULT 70
    );

    CREATE TABLE IF NOT EXISTS enlistment_attempts (
        attempt_id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        quiz_id INTEGER REFERENCES enlistment_quizzes(quiz_id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        passed BOOLEAN NOT NULL,
        attempt_date BIGINT
    );
        -- NOVA TABELA PARA AULAS AGENDADAS --
    CREATE TABLE IF NOT EXISTS academy_events (
        event_id SERIAL PRIMARY KEY,
        course_id TEXT REFERENCES academy_courses(course_id) ON DELETE CASCADE,
        guild_id VARCHAR(255) NOT NULL,
        scheduled_by VARCHAR(255) NOT NULL,
        scheduled_at BIGINT NOT NULL,
        event_time BIGINT NOT NULL,
        title TEXT,
        status TEXT DEFAULT 'scheduled' -- scheduled, completed, cancelled
    );
        CREATE TABLE IF NOT EXISTS academy_events (
        event_id SERIAL PRIMARY KEY,
        course_id TEXT REFERENCES academy_courses(course_id) ON DELETE CASCADE,
        guild_id VARCHAR(255) NOT NULL,
        scheduled_by VARCHAR(255) NOT NULL,
        scheduled_at BIGINT NOT NULL,
        event_time BIGINT NOT NULL,
        title TEXT,
        status TEXT DEFAULT 'scheduled' -- scheduled, completed, cancelled
    );

    -- NOVAS TABELAS PARA O MÓDULO DE CARREIRA V2 --
    CREATE TABLE IF NOT EXISTS rank_requirements (
        role_id VARCHAR(255) PRIMARY KEY,
        previous_role_id VARCHAR(255) NOT NULL,
        required_patrol_hours INTEGER DEFAULT 0,
        required_courses INTEGER DEFAULT 0,
        required_recruits INTEGER DEFAULT 0,
        required_time_in_rank_days INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rank_history (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        role_id VARCHAR(255) NOT NULL,
        promoted_at BIGINT NOT NULL
        promoted_by VARCHAR(255) -- NOVA COLUNA ADICIONADA
    );
`;

// Esta função será chamada na inicialização do bot.
async function initializeDatabase() {
    try {
        console.log('[DATABASE] Verificando o esquema do banco de dados...');
        await db.query(schemaSQL);
        console.log('[DATABASE] Esquema verificado e sincronizado com sucesso.');
    } catch (error) {
        console.error('[DATABASE] Erro crítico ao inicializar o banco de dados:', error);
        process.exit(1); 
    }
}

module.exports = { initializeDatabase };