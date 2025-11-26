const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// データベース初期化
db.initDatabase();

// API エンドポイント

// 事業所一覧の取得
app.get('/api/branches', (req, res) => {
    try {
        const branches = db.getBranches();
        res.json(branches);
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 送付記録の作成
app.post('/api/deliveries', (req, res) => {
    try {
        const { date, fromBranch, toBranch, type, items } = req.body;

        // バリデーション
        if (!date || !fromBranch || !toBranch || !type || !items || items.length === 0) {
            return res.status(400).json({ error: '必須項目が不足しています' });
        }

        const deliveryId = db.createDelivery({
            date,
            fromBranch,
            toBranch,
            type,
            items
        });

        res.status(201).json({
            success: true,
            deliveryId,
            message: '送付記録を作成しました'
        });
    } catch (error) {
        console.error('Error creating delivery:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 送付記録の一覧取得
app.get('/api/deliveries', (req, res) => {
    try {
        const filters = {
            branch: req.query.branch,
            status: req.query.status,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            search: req.query.search
        };

        const deliveries = db.getDeliveries(filters);
        res.json(deliveries);
    } catch (error) {
        console.error('Error fetching deliveries:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 特定の送付記録を取得
app.get('/api/deliveries/:id', (req, res) => {
    try {
        const delivery = db.getDeliveryById(req.params.id);
        if (!delivery) {
            return res.status(404).json({ error: '送付記録が見つかりません' });
        }
        res.json(delivery);
    } catch (error) {
        console.error('Error fetching delivery:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 受領確認
app.put('/api/deliveries/:id/receive', (req, res) => {
    try {
        const { receivedBy } = req.body;
        const result = db.markAsReceived(req.params.id, receivedBy);
        if (result.changes === 0) {
            return res.status(404).json({ error: '送付記録が見つかりません' });
        }
        res.json({
            success: true,
            message: '受領確認を完了しました'
        });
    } catch (error) {
        console.error('Error marking as received:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 送付記録の削除
app.delete('/api/deliveries/:id', (req, res) => {
    try {
        const result = db.deleteDelivery(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: '送付記録が見つかりません' });
        }
        res.json({
            success: true,
            message: '送付記録を削除しました'
        });
    } catch (error) {
        console.error('Error deleting delivery:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// サーバー起動 (Vercel以外の環境)
if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`サーバーが起動しました: http://localhost:${PORT}`);
        const networkInterfaces = require('os').networkInterfaces();
        const addresses = [];
        for (const name of Object.keys(networkInterfaces)) {
            for (const net of networkInterfaces[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    addresses.push(net.address);
                }
            }
        }
        if (addresses.length > 0) {
            console.log(`ネットワークからアクセス: http://${addresses[0]}:${PORT}`);
        }
        console.log('Ctrl+C で終了します');
    });
}

// Vercel用にエクスポート
module.exports = app;
