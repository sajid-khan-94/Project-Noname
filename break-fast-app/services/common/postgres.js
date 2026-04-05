import { Pool } from "pg";

export function createPostgresStore({ connectionString, schemaStatements, seed }) {
  const pool = new Pool({ connectionString });
  let initPromise;

  async function ensureInitialized() {
    if (!initPromise) {
      initPromise = (async () => {
        const client = await pool.connect();
        try {
          for (const statement of schemaStatements) {
            await client.query(statement);
          }
          if (seed) {
            await seed(client);
          }
        } finally {
          client.release();
        }
      })();
    }

    return initPromise;
  }

  async function query(text, params = []) {
    await ensureInitialized();
    return pool.query(text, params);
  }

  async function transaction(callback) {
    await ensureInitialized();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    ensureInitialized,
    query,
    transaction,
  };
}
