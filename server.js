const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./database');
const { syncToSheet } = require('./sheets');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Health check endpoint for cloud services
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV
    });
});

// Generate ID: YYYYMMDD-###
async function generateId() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}`;

    try {
        const result = await db.query(`SELECT id FROM deliveries WHERE id LIKE $1 ORDER BY id DESC LIMIT 1`, [`${datePrefix}-%`]);
        const row = result.rows[0];

        let nextNum = 1;
        if (row) {
            const parts = row.id.split('-');
            if (parts.length === 2) {
                nextNum = parseInt(parts[1], 10) + 1;
            }
        }
        return `${datePrefix}-${String(nextNum).padStart(3, '0')}`;
    } catch (err) {
        throw err;
    }
}

// GET all deliveries
app.get('/api/deliveries', async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM deliveries ORDER BY created_at DESC`);
        // Parse items JSON for each row
        const parsed = result.rows.map(row => {
            try {
                row.items = JSON.parse(row.items || '[]');
            } catch (e) {
                row.items = [];
            }
            return row;
        });
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new delivery
app.post('/api/deliveries', async (req, res) => {
    const { to_site, items, note } = req.body; // items is array: [{item, qty}, ...]

    try {
        const newId = await generateId();
        const itemsJson = JSON.stringify(items);

        // Use generic SQL. For SQLite we rely on the implementation in database.js to return the right thing?
        // Actually both support standard param placeholders usually, but SQLite uses ? often and Postgres uses $1.
        // We need to standardize. 'database.js' for SQLite wrapper uses `sqlite3` which defaults to `?`.
        // `pg` uses `$1`.
        // To support both without an ORM, simple string replacement or a helper is needed.
        // Or, we can stick to `?` and replace it for Postgres in `database.js` wrapper!
        // Let's modify the query calls to use standard `?` and I'll update `database.js` to handle transformation if needed?
        // Actually, `pg` does NOT support `?`. 
        // Simplest way: use separate queries or a helper.
        // Let's update `database.js` to replace `?` with `$n` for Postgres.

        // Wait, I can't easily go back to `database.js` in this single tool call flow easily without context switching.
        // Better: user standard parameter syntax that I choose.
        // Let's assume I will fix `database.js` to convert `?` -> `$1` for Postgres if I use `?` here.
        // BUT, `sqlite3` supports `$param` too? No, it supports `?` or `$name`.
        // Let's stick to `$1` logic for Postgres and make SQLite wrapper handle it? Or vice versa.
        // SQLite `sqlite3` driver doesn't support `$1` syntax natively unless named params.

        // PLAN: I will use `$1` syntax here, and I will issue a fix to `database.js` effectively immediately after or assumes it handles it.
        // WAIT, `database.js` wrapper for SQLite I wrote just passes params straight to `sqliteDb[method]`.
        // So I must match what that database needs.

        // Let's use `?` syntax here and update `database.js` to convert `?` to `$n` for Postgres.
        // That is easier than making SQLite support `$n`.

        const createdAt = new Date().toISOString(); // Use JS date to ensure consistency across DBs

        await db.query(
            `INSERT INTO deliveries (id, from_site, to_site, items, note, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
            [newId, '本部', to_site, itemsJson, note, createdAt]
        );

        const newRecord = {
            id: newId,
            status: '作成済み',
            from_site: '本部',
            to_site,
            items,
            received_check: 0,
            received_at: null,
            note,
            created_at: createdAt
        };

        syncToSheet(newRecord).catch(console.error);
        res.json(newRecord);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST login
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === 'think0305') {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

// PATCH receive
app.patch('/api/deliveries/:id/receive', async (req, res) => {
    const { id } = req.params;
    const { receiver_name } = req.body;
    const received_at = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        await db.query(
            `UPDATE deliveries SET status = $1, received_check = 1, received_at = $2, receiver_name = $3 WHERE id = $4`,
            ['受領済み', received_at, receiver_name, id]
        );

        const result = await db.query(`SELECT * FROM deliveries WHERE id = $1`, [id]);
        if (result.rows.length > 0) {
            syncToSheet(result.rows[0]).catch(console.error);
        }
        res.json({ message: "Received", received_at, receiver_name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET CSV export
app.get('/api/export/csv', async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM deliveries ORDER BY created_at DESC`);
        const rows = result.rows;

        // CSV Header
        let csv = '伝票番号,状態,出庫元,入庫先,品目,受領チェック,受領日,受取人,備考,作成日時\n';

        rows.forEach(row => {
            let itemsDisplay = '';
            try {
                const items = JSON.parse(row.items || '[]');
                itemsDisplay = items.map(i => `${i.item}(${i.qty}袋)`).join('; ');
            } catch (e) {
                itemsDisplay = `${row.item || ''}(${row.qty || 0}袋)`;
            }

            csv += `${row.id},${row.status},${row.from_site},${row.to_site},"${itemsDisplay}","${row.received_check ? 'はい' : 'いいえ'}",${row.received_at || ''},${row.receiver_name || ''},"${(row.note || '').replace(/"/g, '""')}",${row.created_at}\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=deliveries.csv');
        res.send('\uFEFF' + csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE delivery
app.delete('/api/deliveries/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query(`DELETE FROM deliveries WHERE id = $1`, [id]);

        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Delivery not found' });
            return;
        }
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
});

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    if (NODE_ENV !== 'production') {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    server.close(() => {
        console.log('HTTP server closed');
        if (db && db.close) {
            // Handle potential promise or callback style close
            try {
                const closeRes = db.close(() => {
                    console.log('Database connection closed');
                    process.exit(0);
                });
                // If it returns a promise (pg pool)
                if (closeRes && typeof closeRes.then === 'function') {
                    closeRes.then(() => {
                        console.log('Database connection closed');
                        process.exit(0);
                    });
                }
            } catch (e) {
                console.error('Error closing db', e);
                process.exit(1);
            }
        } else {
            process.exit(0);
        }
    });

    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
