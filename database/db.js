const { Pool } = require('pg');
require('dotenv').config();

// Cria um "pool" de conexões usando a URL do seu arquivo .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Substitui a necessidade de "abrir" e "fechar" o banco de dados a cada comando.
// O pool gerencia as conexões de forma muito mais eficiente.

module.exports = {
  /**
   * Executa uma query no banco de dados.
   * @param {string} text A query SQL (ex: 'SELECT * FROM users WHERE id = $1')
   * @param {Array} params Os parâmetros para a query (ex: [1])
   * @returns {Promise<any>}
   */
  query: (text, params) => pool.query(text, params),

  /**
   * Função para buscar uma única linha (compatível com o código antigo).
   * @param {string} sql 
   * @param {Array} params 
   */
  get: async (sql, params) => {
    // Converte o placeholder '?' do SQLite para '$1, $2, ...' do PostgreSQL
    const pgSql = sql.replace(/\?/g, (match, index, str) => `$${str.slice(0, index).split('?').length}`);
    const res = await pool.query(pgSql, params);
    return res.rows[0];
  },

  /**
   * Função para buscar todas as linhas (compatível com o código antigo).
   * @param {string} sql 
   * @param {Array} params 
   */
  all: async (sql, params) => {
    const pgSql = sql.replace(/\?/g, (match, index, str) => `$${str.slice(0, index).split('?').length}`);
    const res = await pool.query(pgSql, params);
    return res.rows;
  },

  /**
   * Função para executar um comando (INSERT, UPDATE, DELETE) (compatível com o código antigo).
   * @param {string} sql 
   * @param {Array} params 
   */
  run: async (sql, params) => {
    const pgSql = sql.replace(/\?/g, (match, index, str) => `$${str.slice(0, index).split('?').length}`);
    return pool.query(pgSql, params);
  }
};