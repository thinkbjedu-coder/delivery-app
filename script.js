// 環境に応じてAPI_BASEを自動設定
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:${window.location.port || 3000}/api`
    : `${window.location.origin}/api`;

// パスワード設定
const CORRECT_PASSWORD = 'think0305';
const AUTH_TOKEN_KEY = 'delivery_app_auth';

let currentReceiveId = null; // 受領確認中のID

document.addEventListener('DOMContentLoaded', () => {
    // 認証チェック
    checkAuth();

    // ログインフォーム
    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = passwordInput.value;

        if (password === CORRECT_PASSWORD) {
            // 認証成功
            sessionStorage.setItem(AUTH_TOKEN_KEY, 'authenticated');
            showApp();
            passwordInput.value = '';
            loginError.style.display = 'none';
        } else {
            // 認証失敗
            loginError.textContent = 'パスワードが正しくありません';
            loginError.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (confirm('ログアウトしますか?')) {
            sessionStorage.removeItem(AUTH_TOKEN_KEY);
            hideApp();
        }
    });

    // Elements
    const navTabs = document.querySelectorAll('.nav-tab');
    const createView = document.querySelector('.create-view');
    const historyView = document.querySelector('.history-view');
    const receiveView = document.querySelector('.receive-view');

    const fromBranchSelect = document.getElementById('from-branch-select');
    const toBranchSelect = document.getElementById('to-branch-select');
    const filterBranchSelect = document.getElementById('filter-branch');
    const currentDateEl = document.getElementById('current-date');
    const itemList = document.getElementById('item-list');
    const addItemBtn = document.getElementById('add-item-btn');
    const saveBtn = document.getElementById('save-btn');
    const printBtn = document.getElementById('print-btn');

    const filterStatusSelect = document.getElementById('filter-status');
    const filterSearchInput = document.getElementById('filter-search');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const historyTbody = document.getElementById('history-tbody');
    const noHistory = document.getElementById('no-history');

    const receiveFilterBranchSelect = document.getElementById('receive-filter-branch');
    const receiveFilterSearchInput = document.getElementById('receive-filter-search');
    const applyReceiveFilterBtn = document.getElementById('apply-receive-filter-btn');
    const receiveTbody = document.getElementById('receive-tbody');
    const noReceive = document.getElementById('no-receive');

    const detailModal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');
    const modalClose = document.querySelector('.modal-close');

    const receiverModal = document.getElementById('receiver-modal');
    const receiverName = document.getElementById('receiver-name');
    const modalCloseReceiver = document.querySelector('.modal-close-receiver');
    const confirmReceiveBtn = document.getElementById('confirm-receive-btn');

    const printTitle = document.getElementById('print-title');
    const printDate = document.getElementById('print-date');
    const printBranch = document.getElementById('print-branch');
    const printItemsBody = document.getElementById('print-items-body');

    // Initialize
    function init() {
        loadBranches();
        updateDate();
        addItemRow();
        setupEventListeners();
    }

    // 認証チェック
    function checkAuth() {
        const isAuthenticated = sessionStorage.getItem(AUTH_TOKEN_KEY) === 'authenticated';
        if (isAuthenticated) {
            showApp();
        } else {
            hideApp();
        }
    }

    // アプリケーションを表示
    function showApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        init();
    }

    // アプリケーションを非表示
    function hideApp() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }

    // Event Listeners
    function setupEventListeners() {
        navTabs.forEach(tab => {
            tab.addEventListener('click', () => switchView(tab.dataset.view));
        });

        addItemBtn.addEventListener('click', addItemRow);
        saveBtn.addEventListener('click', saveDelivery);
        printBtn.addEventListener('click', printDelivery);
        applyFilterBtn.addEventListener('click', loadHistory);
        applyReceiveFilterBtn.addEventListener('click', loadReceiveList);
        modalClose.addEventListener('click', closeModal);
        modalCloseReceiver.addEventListener('click', closeReceiverModal);
        confirmReceiveBtn.addEventListener('click', window.confirmReceive);

        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) closeModal();
        });

        receiverModal.addEventListener('click', (e) => {
            if (e.target === receiverModal) closeReceiverModal();
        });
    }

    // View Switching
    function switchView(view) {
        navTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });

        if (view === 'create') {
            createView.style.display = 'block';
            historyView.style.display = 'none';
            receiveView.style.display = 'none';
        } else if (view === 'history') {
            createView.style.display = 'none';
            historyView.style.display = 'block';
            receiveView.style.display = 'none';
            loadHistory();
        } else if (view === 'receive') {
            createView.style.display = 'none';
            historyView.style.display = 'none';
            receiveView.style.display = 'block';
            loadReceiveList();
        }
    }

    // Load Branches
    async function loadBranches() {
        try {
            const response = await fetch(`${API_BASE}/branches`);
            const branches = await response.json();

            branches.forEach(branch => {
                const optionFrom = document.createElement('option');
                optionFrom.value = branch;
                optionFrom.textContent = branch;

                const optionTo = document.createElement('option');
                optionTo.value = branch;
                optionTo.textContent = branch;

                const optionFilter = document.createElement('option');
                optionFilter.value = branch;
                optionFilter.textContent = branch;

                // 法人本部をデフォルトに設定
                if (branch === '法人本部') {
                    optionFrom.selected = true;
                }

                fromBranchSelect.appendChild(optionFrom);
                toBranchSelect.appendChild(optionTo);
                filterBranchSelect.appendChild(optionFilter);

                // 受領確認ビュー用のフィルターにも追加
                const optionReceiveFilter = document.createElement('option');
                optionReceiveFilter.value = branch;
                optionReceiveFilter.textContent = branch;
                receiveFilterBranchSelect.appendChild(optionReceiveFilter);
            });
        } catch (error) {
            console.error('Error loading branches:', error);
        }
    }

    // Update Date
    function updateDate() {
        const now = new Date();
        const y = now.getFullYear();
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        const d = now.getDate().toString().padStart(2, '0');
        const day = ['日', '月', '火', '水', '木', '金', '土'][now.getDay()];
        const dateStr = `${y}/${m}/${d}(${day})`;
        currentDateEl.textContent = dateStr;
    }

    // Add Item Row
    function addItemRow() {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
            <input type="text" placeholder="品名を入力" class="item-name">
            <input type="number" placeholder="1" value="1" min="1" class="item-qty">
            <button class="btn-remove" title="削除">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        row.querySelector('.btn-remove').addEventListener('click', () => {
            if (itemList.children.length > 1) {
                row.remove();
            } else {
                row.querySelector('.item-name').value = '';
                row.querySelector('.item-qty').value = '1';
            }
        });

        itemList.appendChild(row);
        row.querySelector('.item-name').focus();
    }

    // Save Delivery
    async function saveDelivery() {
        const fromBranch = fromBranchSelect.value;
        const toBranch = toBranchSelect.value;
        const noteType = document.querySelector('input[name="note-type"]:checked').value;
        const date = currentDateEl.textContent;

        if (!fromBranch || !toBranch) {
            alert('送付元と送付先を選択してください');
            return;
        }

        const items = [];
        const rows = itemList.querySelectorAll('.item-row');

        rows.forEach(row => {
            const name = row.querySelector('.item-name').value.trim();
            const quantity = parseInt(row.querySelector('.item-qty').value);
            if (name) {
                items.push({ name, quantity });
            }
        });

        if (items.length === 0) {
            alert('品名を入力してください');
            return;
        }

        // 確認ダイアログを表示
        const itemsText = items.map(item => `${item.name} × ${item.quantity}`).join('\n');
        const confirmMessage = `以下の内容で保存します。よろしいですか?\n\n送付元: ${fromBranch}\n送付先: ${toBranch}\n種別: ${noteType}\n\n品目:\n${itemsText}`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/deliveries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    fromBranch,
                    toBranch,
                    type: noteType,
                    items
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert('送付記録を保存しました');
                // Clear form
                toBranchSelect.value = '';
                itemList.innerHTML = '';
                addItemRow();
            } else {
                alert('エラー: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving delivery:', error);
            alert('サーバーに接続できません。サーバーが起動しているか確認してください。');
        }
    }

    // Print Delivery
    function printDelivery() {
        const fromBranch = fromBranchSelect.value;
        const toBranch = toBranchSelect.value;
        const noteType = document.querySelector('input[name="note-type"]:checked').value;

        if (!fromBranch || !toBranch) {
            alert('送付元と送付先を選択してください');
            return;
        }

        printTitle.textContent = noteType;
        printDate.textContent = currentDateEl.textContent;
        printBranch.textContent = toBranch;

        printItemsBody.innerHTML = '';
        const rows = itemList.querySelectorAll('.item-row');
        let hasItems = false;

        rows.forEach((row, index) => {
            const name = row.querySelector('.item-name').value.trim();
            const qty = row.querySelector('.item-qty').value;

            if (name) {
                hasItems = true;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${name}</td>
                    <td>${qty}</td>
                    <td></td>
                `;
                printItemsBody.appendChild(tr);
            }
        });

        if (!hasItems) {
            alert('品名を入力してください');
            return;
        }

        window.print();
    }

    // Load History
    async function loadHistory() {
        const filters = {
            branch: filterBranchSelect.value,
            status: filterStatusSelect.value,
            search: filterSearchInput.value
        };

        try {
            const params = new URLSearchParams();
            const response = await fetch(`${API_BASE}/branches`);
            const branches = await response.json();

            branches.forEach(branch => {
                const optionFrom = document.createElement('option');
                optionFrom.value = branch;
                optionFrom.textContent = branch;

                const optionTo = document.createElement('option');
                optionTo.value = branch;
                optionTo.textContent = branch;

                const optionFilter = document.createElement('option');
                optionFilter.value = branch;
                optionFilter.textContent = branch;

                // 法人本部をデフォルトに設定
                if (branch === '法人本部') {
                    optionFrom.selected = true;
                }

                fromBranchSelect.appendChild(optionFrom);
                toBranchSelect.appendChild(optionTo);
                filterBranchSelect.appendChild(optionFilter);

                // 受領確認ビュー用のフィルターにも追加
                const optionReceiveFilter = document.createElement('option');
                optionReceiveFilter.value = branch;
                optionReceiveFilter.textContent = branch;
                receiveFilterBranchSelect.appendChild(optionReceiveFilter);
            });
        } catch (error) {
            console.error('Error loading branches:', error);
        }
    }

    // Update Date
    function updateDate() {
        const now = new Date();
        const y = now.getFullYear();
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        const d = now.getDate().toString().padStart(2, '0');
        const day = ['日', '月', '火', '水', '木', '金', '土'][now.getDay()];
        const dateStr = `${y}/${m}/${d}(${day})`;
        currentDateEl.textContent = dateStr;
    }

    // Add Item Row
    function addItemRow() {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
            <input type="text" placeholder="品名を入力" class="item-name">
            <input type="number" placeholder="1" value="1" min="1" class="item-qty">
            <button class="btn-remove" title="削除">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        row.querySelector('.btn-remove').addEventListener('click', () => {
            if (itemList.children.length > 1) {
                row.remove();
            } else {
                row.querySelector('.item-name').value = '';
                row.querySelector('.item-qty').value = '1';
            }
        });

        itemList.appendChild(row);
        row.querySelector('.item-name').focus();
    }

    // Save Delivery
    async function saveDelivery() {
        const fromBranch = fromBranchSelect.value;
        const toBranch = toBranchSelect.value;
        const noteType = document.querySelector('input[name="note-type"]:checked').value;
        const date = currentDateEl.textContent;

        if (!fromBranch || !toBranch) {
            alert('送付元と送付先を選択してください');
            return;
        }

        const items = [];
        const rows = itemList.querySelectorAll('.item-row');

        rows.forEach(row => {
            const name = row.querySelector('.item-name').value.trim();
            const quantity = parseInt(row.querySelector('.item-qty').value);
            if (name) {
                items.push({ name, quantity });
            }
        });

        if (items.length === 0) {
            alert('品名を入力してください');
            return;
        }

        // 確認ダイアログを表示
        const itemsText = items.map(item => `${item.name} × ${item.quantity}`).join('\n');
        const confirmMessage = `以下の内容で保存します。よろしいですか?\n\n送付元: ${fromBranch}\n送付先: ${toBranch}\n種別: ${noteType}\n\n品目:\n${itemsText}`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/deliveries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    fromBranch,
                    toBranch,
                    type: noteType,
                    items
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert('送付記録を保存しました');
                // Clear form
                toBranchSelect.value = '';
                itemList.innerHTML = '';
                addItemRow();
            } else {
                alert('エラー: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving delivery:', error);
            alert('サーバーに接続できません。サーバーが起動しているか確認してください。');
        }
    }

    // Print Delivery
    function printDelivery() {
        const fromBranch = fromBranchSelect.value;
        const toBranch = toBranchSelect.value;
        const noteType = document.querySelector('input[name="note-type"]:checked').value;

        if (!fromBranch || !toBranch) {
            alert('送付元と送付先を選択してください');
            return;
        }

        printTitle.textContent = noteType;
        printDate.textContent = currentDateEl.textContent;
        printBranch.textContent = toBranch;

        printItemsBody.innerHTML = '';
        const rows = itemList.querySelectorAll('.item-row');
        let hasItems = false;

        rows.forEach((row, index) => {
            const name = row.querySelector('.item-name').value.trim();
            const qty = row.querySelector('.item-qty').value;

            if (name) {
                hasItems = true;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${name}</td>
                    <td>${qty}</td>
                    <td></td>
                `;
                printItemsBody.appendChild(tr);
            }
        });

        if (!hasItems) {
            alert('品名を入力してください');
            return;
        }

        window.print();
    }

    // Load History
    async function loadHistory() {
        const filters = {
            branch: filterBranchSelect.value,
            status: filterStatusSelect.value,
            search: filterSearchInput.value
        };

        try {
            const params = new URLSearchParams();
            if (filters.branch) params.append('branch', filters.branch);
            if (filters.status) params.append('status', filters.status);
            if (filters.search) params.append('search', filters.search);

            const response = await fetch(`${API_BASE}/deliveries?${params}`);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            const deliveries = await response.json();

            if (!Array.isArray(deliveries)) {
                console.error('Expected array but got:', deliveries);
                throw new Error('Invalid data format received from server');
            }

            renderHistory(deliveries);
        } catch (error) {
            console.error('Error loading history:', error);
            alert(`履歴の読み込みに失敗しました: ${error.message}`);
        }
    }

    // Render History
    function renderHistory(deliveries) {
        historyTbody.innerHTML = '';

        if (deliveries.length === 0) {
            noHistory.style.display = 'block';
            return;
        }

        noHistory.style.display = 'none';

        deliveries.forEach(delivery => {
            const tr = document.createElement('tr');
            const statusClass = delivery.status === 'received' ? 'status-received' : 'status-sent';
            const statusText = delivery.status === 'received' ? '済' : '未';
            const itemsText = Array.isArray(delivery.items)
                ? delivery.items.map(i => i.name).join(', ')
                : (delivery.items || '-');

            tr.innerHTML = `
                <td>${delivery.date}</td>
                <td>${delivery.from_branch}</td>
                <td>${delivery.to_branch}</td>
                <td>${itemsText}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-small btn-secondary-action" onclick="viewDetail(${delivery.id})">詳細</button>
                    <button class="btn btn-small btn-danger" onclick="deleteDelivery(${delivery.id})">削除</button>
                </td>
            `;
            historyTbody.appendChild(tr);
        });
    }

    // Load Receive List
    async function loadReceiveList() {
        const filters = {
            branch: receiveFilterBranchSelect.value,
            status: 'sent', // 受領待ちのみ
            search: receiveFilterSearchInput.value
        };

        try {
            const params = new URLSearchParams();
            if (filters.branch) params.append('branch', filters.branch);
            params.append('status', filters.status);
            if (filters.search) params.append('search', filters.search);

            const response = await fetch(`${API_BASE}/deliveries?${params}`);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            const deliveries = await response.json();

            if (!Array.isArray(deliveries)) {
                throw new Error('Invalid data format');
            }

            renderReceiveList(deliveries);
        } catch (error) {
            console.error('Error loading receive list:', error);
            alert(`受領待ちリストの読み込みに失敗しました: ${error.message}`);
        }
    }

    // Render Receive List
    function renderReceiveList(deliveries) {
        receiveTbody.innerHTML = '';

        if (deliveries.length === 0) {
            noReceive.style.display = 'block';
            return;
        }

        noReceive.style.display = 'none';

        deliveries.forEach(delivery => {
            const tr = document.createElement('tr');
            const itemsText = Array.isArray(delivery.items)
                ? delivery.items.map(i => i.name).join(', ')
                : (delivery.items || '-');

            tr.innerHTML = `
                <td>${delivery.date}</td>
                <td>${delivery.from_branch}</td>
                <td>${delivery.to_branch}</td>
                <td>${itemsText}</td>
                <td>
                    <button class="btn btn-small btn-secondary-action" onclick="viewDetail(${delivery.id})">詳細</button>
                    <button class="btn btn-small btn-primary" onclick="markReceived(${delivery.id})">受領確認</button>
                </td>
            `;
            receiveTbody.appendChild(tr);
        });
    }

    // Close Modal
    function closeModal() {
        detailModal.classList.remove('active');
    }

    // Close Receiver Modal
    function closeReceiverModal() {
        receiverModal.classList.remove('active');
        currentReceiveId = null;
    }
});

// Global Functions (Outside DOMContentLoaded to ensure availability)
// View Detail
window.viewDetail = async function (id) {
    const detailModal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');

    try {
        // API_BASE is defined globally at the top
        const response = await fetch(`${API_BASE}/deliveries/${id}`);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const delivery = await response.json();

        modalBody.innerHTML = `
            <div style="margin-bottom: 1rem;">
                <strong>種別:</strong> ${delivery.type}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>日付:</strong> ${delivery.date}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>送付元:</strong> ${delivery.from_branch}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>送付先:</strong> ${delivery.to_branch}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>ステータス:</strong> ${delivery.status === 'received' ? '受領済み' : '送付済み'}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>品目:</strong>
                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                    ${delivery.items.map(item => `<li>${item.name || item.item_name} × ${item.quantity}</li>`).join('')}
                </ul>
            </div>
            ${delivery.received_at ? `<div style="margin-bottom: 0.5rem;"><strong>受領日時:</strong> ${new Date(delivery.received_at).toLocaleString('ja-JP')}</div>` : ''}
            ${delivery.received_by ? `<div><strong>受取人:</strong> ${delivery.received_by}</div>` : ''}
        `;

        detailModal.classList.add('active');
    } catch (error) {
        console.error('Error loading detail:', error);
        alert(`詳細の読み込みに失敗しました: ${error.message}`);
    }
};

// Mark as Received
window.markReceived = function (id) {
    // currentReceiveId is defined globally at the top
    currentReceiveId = id;
    const receiverModal = document.getElementById('receiver-modal');
    const receiverName = document.getElementById('receiver-name');
    receiverName.value = '';
    receiverModal.classList.add('active');

    // Re-attach event listener to confirm button to be sure
    const confirmBtn = document.getElementById('confirm-receive-btn');
    // Remove old listener to avoid duplicates (requires named function, but here we just replace it or ensure it's there)
    // A better way is to rely on the static listener, but if it's failing, we can try to force it here.
    // But let's stick to the static listener first, checking if the element exists.
    if (!confirmBtn) console.error('Confirm button not found!');
};

// Confirm Receive
window.confirmReceive = async function () {
    const receiverName = document.getElementById('receiver-name');
    const name = receiverName.value.trim();

    if (!name) {
        alert('受取人名を入力してください');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/deliveries/${currentReceiveId}/receive`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receivedBy: name })
        });

        const result = await response.json();

        if (response.ok) {
            alert('受領確認を完了しました');
            const receiverModal = document.getElementById('receiver-modal');
            receiverModal.classList.remove('active');
            currentReceiveId = null;

            // Reload lists
            const receiveView = document.querySelector('.receive-view');
            if (receiveView && receiveView.style.display !== 'none') {
                const applyReceiveFilterBtn = document.getElementById('apply-receive-filter-btn');
                if (applyReceiveFilterBtn) applyReceiveFilterBtn.click();
            } else {
                const applyFilterBtn = document.getElementById('apply-filter-btn');
                if (applyFilterBtn) applyFilterBtn.click();
            }
        } else {
            alert('エラー: ' + result.error);
        }
    } catch (error) {
        console.error('Error marking as received:', error);
        alert(`受領確認に失敗しました: ${error.message}`);
    }
};

// Delete Delivery
window.deleteDelivery = async function (id) {
    if (!confirm('この送付記録を削除しますか?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/deliveries/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            alert('送付記録を削除しました');
            const applyFilterBtn = document.getElementById('apply-filter-btn');
            if (applyFilterBtn) applyFilterBtn.click();
        } else {
            alert('エラー: ' + result.error);
        }
    } catch (error) {
        console.error('Error deleting delivery:', error);
        alert(`削除に失敗しました: ${error.message}`);
    }
};
