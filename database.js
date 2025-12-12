const path = require('path');

// Determine environment
const connectionString = process.env.INTERNAL_DATABASE_URL || process.env.DATABASE_URL;
const isProduction = !!connectionString;

let db;

if (isProduction) {
    // PostgreSQL (Render)
    const { Pool } = require('pg');
    console.log('Using PostgreSQL database');

    const pool = new Pool({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    db = {
        query: (text, params) => pool.query(text, params),
        close: () => pool.end()
    };

    initPgSchema(db);

} else {
    // SQLite (Local)
    const sqlite3 = require('sqlite3').verbose();
    console.log('Using SQLite database (Local)');

    const dbPath = path.resolve(__dirname, 'deliveries.db');
    const sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
        } else {
            console.log('Connected to the SQLite database.');
            sqliteDb.configure('busyTimeout', 5000);
            initSqliteSchema(sqliteDb);
        }
    });

    // Wrapper to make SQLite behave like Postgres (Promise-based query)
    db = {
        query: (text, params = []) => {
            return new Promise((resolve, reject) => {
                // Determine if it's a SELECT or INSERT/UPDATE/DELETE
                const method = text.trim().toUpperCase().startsWith('SELECT') ? 'all' : 'run';

                sqliteDb[method](text, params, function (err, rows) {
                    if (err) {
                        reject(err);
                    } else {
                        // For INSERT/UPDATE, 'this' contains changes/lastID
                        if (method === 'run') {
                            resolve({ rows: [], rowCount: this.changes, lastID: this.lastID });
                        } else {
                            resolve({ rows: rows, rowCount: rows.length });
                        }
                    }
                });
            });
        },
        close: (cb) => sqliteDb.close(cb)
    };
}

// PostgreSQL Initial Schema
async function initPgSchema(database) {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS deliveries (
            id TEXT PRIMARY KEY,
            status TEXT DEFAULT '作成済み',
            from_site TEXT DEFAULT '本部',
            to_site TEXT NOT NULL,
            items TEXT NOT NULL,
            received_check INTEGER DEFAULT 0,
            received_at TEXT,
            receiver_name TEXT,
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    try {
        await database.query(createTableQuery);
        console.log('PostgreSQL: Table "deliveries" ready.');
    } catch (err) {
        console.error('Error creating table in Postgres:', err);
    }
}

// SQLite Initial Schema
function initSqliteSchema(database) {
    database.run(`CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY,
        status TEXT DEFAULT '作成済み',
        from_site TEXT DEFAULT '本部',
        to_site TEXT NOT NULL,
        items TEXT NOT NULL,
        received_check INTEGER DEFAULT 0,
        received_at TEXT,
        receiver_name TEXT,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('SQLite: Table "deliveries" ready.');
        }
    });
}

module.exports = db;
