// extension/popup/popup.js
document.addEventListener('DOMContentLoaded', () => {
    const CONSOLE_URL = 'http://127.0.0.1:5173/';
    const API_BASE = 'http://127.0.0.1:8000';

    const themePill = document.getElementById('theme-pill');
    function applyTheme() {
        try {
            const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.toggle('dark', !!isDark);
            if (themePill) themePill.textContent = isDark ? '深色' : '浅色';
        } catch (e) {}
    }
    try {
        if (window.matchMedia) {
            const m = window.matchMedia('(prefers-color-scheme: dark)');
            if (m && m.addEventListener) m.addEventListener('change', applyTheme);
        }
    } catch (e) {}
    applyTheme();

    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const clearBtn = document.getElementById('clear-btn');
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    const actionCount = document.getElementById('action-count');
    const syncStatus = document.getElementById('sync-status');
    const openConsoleBtn = document.getElementById('open-console-btn');

    let isSyncing = false;
    let lastSyncedCaseId = null;

    function setSyncStatus(message, type) {
        if (!syncStatus) return;
        syncStatus.textContent = message || '';
        syncStatus.className = type ? `sync-status ${type}` : 'sync-status';
    }

    function setControlsDisabled(disabled) {
        startBtn.disabled = disabled;
        stopBtn.disabled = disabled;
        clearBtn.disabled = disabled;
    }

    function updateUI() {
        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
            if (isSyncing) {
                statusText.textContent = '正在同步...';
                statusText.className = 'syncing';
                statusDot.className = 'dot syncing';
                setControlsDisabled(true);
                return;
            }

            if (res && res.isRecording) {
                statusText.textContent = '录制中...';
                statusText.className = 'recording';
                statusDot.className = 'dot recording';
                startBtn.disabled = true;
                stopBtn.disabled = false;
                clearBtn.disabled = true;
            } else {
                statusText.textContent = '系统就绪';
                statusText.className = '';
                statusDot.className = 'dot';
                startBtn.disabled = false;
                stopBtn.disabled = true;
                clearBtn.disabled = false;
            }
            actionCount.textContent = res ? res.actionCount : 0;
        });
    }

    function downloadRecordedCase(payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${payload.name}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function getServerErrorMessage(response) {
        try {
            const data = await response.json();
            if (typeof data?.detail === 'string') return data.detail;
            if (data?.detail?.error) return data.detail.error;
            if (data?.error) return data.error;
            return JSON.stringify(data);
        } catch (e) {
            return `HTTP ${response.status}`;
        }
    }

    async function syncRecordedCase(actions) {
        if (!actions || actions.length === 0) {
            setSyncStatus('没有录制到任何动作。', 'error');
            alert('没有录制到任何动作。');
            return;
        }

        const defaultFileName = `case_${new Date().getTime()}`;
        const payload = {
            name: defaultFileName,
            start_url: actions[0] && actions[0].url ? actions[0].url : null,
            steps: actions,
            variables: {},
            dataset: [],
            type: 'json'
        };

        isSyncing = true;
        setSyncStatus('正在同步到本地控制台...', 'syncing');
        updateUI();

        try {
            const response = await fetch(`${API_BASE}/api/recorder/cases`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const serverMessage = await getServerErrorMessage(response);
                throw new Error(serverMessage || `HTTP ${response.status}`);
            }

            const data = await response.json().catch(() => ({}));
            lastSyncedCaseId = data.id || null;
            setSyncStatus(`同步成功：${lastSyncedCaseId || defaultFileName}。控制台页面刷新后可见。`, 'success');
            chrome.tabs.create({ url: CONSOLE_URL });
        } catch (e) {
            console.error('同步失败，降级为下载文件', e);
            downloadRecordedCase(payload);
            const message = e instanceof Error ? e.message : String(e);
            setSyncStatus(`同步失败，已下载 JSON。原因：${message}`, 'error');
            alert(`同步失败，已自动下载 JSON 文件。\n\n常见原因：本地后端未启动、端口不是 8000、或用例字段校验失败。\n\n错误：${message}`);
        } finally {
            isSyncing = false;
            updateUI();
        }
    }

    startBtn.addEventListener('click', () => {
        setSyncStatus('', '');
        lastSyncedCaseId = null;
        chrome.runtime.sendMessage({ type: 'START_RECORDING' }, () => updateUI());
    });

    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, async (res) => {
            if (res && res.actions) {
                await syncRecordedCase(res.actions);
            } else {
                setSyncStatus('获取录制数据失败。', 'error');
                alert('获取录制数据失败。');
            }
        });
    });

    clearBtn.addEventListener('click', () => {
        setSyncStatus('', '');
        lastSyncedCaseId = null;
        chrome.runtime.sendMessage({ type: 'CLEAR_ACTIONS' }, () => updateUI());
    });

    if (openConsoleBtn) {
        openConsoleBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: CONSOLE_URL });
        });
    }

    updateUI();
});
