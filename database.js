const fs = require('fs');
const path = require('path');

// データファイルのパス
const dataPath = path.join(__dirname, 'deliveries.json');

// データ構造
let data = {
    deliveries: [],
    deliveryItems: [],
    nextDeliveryId: 1,
    nextItemId: 1
};

// データベースの初期化
function initDatabase() {
    if (fs.existsSync(dataPath)) {
        try {
            const fileContent = fs.readFileSync(dataPath, 'utf8');
            data = JSON.parse(fileContent);
            console.log('既存のデータベースを読み込みました');
        } catch (error) {
            console.error('データベースの読み込みに失敗しました:', error);
            saveData();
        }
    } else {
        saveData();
        console.log('新しいデータベースを作成しました');
    }
}

// データの保存
function saveData() {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('データの保存に失敗しました:', error);
    }
}

// 送付記録の作成
function createDelivery(deliveryData) {
    const { date, fromBranch, toBranch, type, items } = deliveryData;
    const createdAt = new Date().toISOString();
    const deliveryId = data.nextDeliveryId++;

    // 送付記録を追加
    data.deliveries.push({
        id: deliveryId,
        date,
        from_branch: fromBranch,
        to_branch: toBranch,
        type,
        status: 'sent',
        created_at: createdAt,
        received_at: null,
        received_by: null
    });

    // 品目を追加
    for (const item of items) {
        data.deliveryItems.push({
            id: data.nextItemId++,
            delivery_id: deliveryId,
            item_name: item.name,
            quantity: item.quantity
        });
    }

    saveData();
    return deliveryId;
}

// 送付記録の一覧取得
function getDeliveries(filters = {}) {
    let results = [...data.deliveries];

    // フィルタリング
    if (filters.branch) {
        results = results.filter(d =>
            d.from_branch === filters.branch || d.to_branch === filters.branch
        );
    }

    if (filters.status) {
        results = results.filter(d => d.status === filters.status);
    }

    if (filters.dateFrom) {
        results = results.filter(d => d.date >= filters.dateFrom);
    }

    if (filters.dateTo) {
        results = results.filter(d => d.date <= filters.dateTo);
    }

    // 品目情報を結合
    results = results.map(delivery => {
        const items = data.deliveryItems
            .filter(item => item.delivery_id === delivery.id)
            .map(item => `${item.item_name} (x${item.quantity})`)
            .join(', ');

        return { ...delivery, items };
    });

    // 検索フィルタ
    if (filters.search) {
        results = results.filter(d =>
            d.items && d.items.toLowerCase().includes(filters.search.toLowerCase())
        );
    }

    // 作成日時の降順でソート
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return results;
}

// 特定の送付記録を取得
function getDeliveryById(id) {
    const delivery = data.deliveries.find(d => d.id === parseInt(id));
    if (!delivery) return null;

    const items = data.deliveryItems.filter(item => item.delivery_id === parseInt(id));
    return { ...delivery, items };
}

// 受領確認
function markAsReceived(id, receivedBy) {
    const deliveryId = parseInt(id);
    const delivery = data.deliveries.find(d => d.id === deliveryId);

    if (!delivery) {
        return { changes: 0 };
    }

    delivery.status = 'received';
    delivery.received_at = new Date().toISOString();
    delivery.received_by = receivedBy || null;

    saveData();
    return { changes: 1 };
}

// 送付記録の削除
function deleteDelivery(id) {
    const deliveryId = parseInt(id);
    const deliveryIndex = data.deliveries.findIndex(d => d.id === deliveryId);

    if (deliveryIndex === -1) {
        return { changes: 0 };
    }

    // 送付記録を削除
    data.deliveries.splice(deliveryIndex, 1);

    // 関連する品目も削除
    data.deliveryItems = data.deliveryItems.filter(item => item.delivery_id !== deliveryId);

    saveData();
    return { changes: 1 };
}

// 事業所一覧を取得
function getBranches() {
    return [
        "法人本部",
        "リハビリフィットネス大永寺",
        "リハビリフィットネス守山",
        "リハビリフィットネス旭",
        "リハビリフィットネス長久手",
        "Co.メディカルフィットネス旭",
        "Life Up 可児",
        "Think Life守山",
        "Think Life大曽根",
        "Think Life旭",
        "Life Up 訪問看護ステーション可児",
        "訪問看護ステーション守山",
        "訪問看護ステーション旭"
    ];
}

module.exports = {
    initDatabase,
    createDelivery,
    getDeliveries,
    getDeliveryById,
    markAsReceived,
    deleteDelivery,
    getBranches
};
