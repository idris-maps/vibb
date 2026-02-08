import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

// Lazy database initialization
let db = null;

/**
 * Get database instance (lazy initialization)
 * @returns {DB} Database instance
 */
function getDatabase() {
  if (!db) {
    db = new DB("test.db");
  }
  return db;
}

/**
 * @typedef {Object} RequestContext
 * @property {Record<string, string>} params - URL parameters
 * @property {Record<string, string>} query - Query parameters
 */

/**
 * @typedef {Object} SQLiteConfig
 * @property {string} sql - SQL query string
 * @property {any[]} [parameters=[]] - Query parameters
 * @property {boolean} [return_one=false] - Return single result vs array
 */

// SQLite strategy implementation
/**
 * Execute SQLite query strategy
 * @param {SQLiteConfig} config - SQLite configuration
 * @returns {Promise<any>} Query result
 */
export async function sqliteStrategy(config) {
  const { sql, parameters = [], return_one = false } = config;

  console.log(`[SQLiteStrategy] Executing SQL:`, sql);
  console.log(`[SQLiteStrategy] Parameters:`, parameters);

  try {
    const database = getDatabase();
    let result;

    if (return_one) {
      // Execute query and return single result
      result = database.query(sql, parameters);
      console.log(`[SQLiteStrategy] Query result:`, result);

      // Return first row if results exist
      if (result.length > 0) {
        return result[0];
      }
      return null;
    } else {
      // Execute query and return all results
      result = database.query(sql, parameters);
      console.log(`[SQLiteStrategy] Query result:`, result);
      return result;
    }
  } catch (error) {
    console.error(`[SQLiteStrategy] SQL error:`, error);
    throw error;
  }
}
