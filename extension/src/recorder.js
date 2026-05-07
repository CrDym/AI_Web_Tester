// extension/src/recorder.js
let isRecording = false;
let actionCount = 0;
let lastRecordedText = "";
let overlayEl = null;
let overlayDotEl = null;
let overlayStatusEl = null;
let overlayCountEl = null;
let overlayLastEl = null;
let clickLayerEl = null;
let dragState = null;

// 轮询同步后台状态
setInterval(() => {
    try {
        chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
            if (res && res.isRecording !== undefined) {
                applyStatus(res);
            }
        });
    } catch (e) {
        // 如果插件重新加载了，连接可能会断开
    }
}, 1000);

function applyStatus(res) {
    isRecording = !!res.isRecording;
    actionCount = typeof res.actionCount === "number" ? res.actionCount : actionCount;
    ensureOverlay();
    updateOverlay();
}

try {
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "STATUS_UPDATE") {
            applyStatus(msg);
        }
    });
} catch (e) {}

function applyThemeFlag() {
    try {
        const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (overlayEl) overlayEl.classList.toggle("ai-dark", !!isDark);
    } catch (e) {}
}

try {
    if (window.matchMedia) {
        const m = window.matchMedia("(prefers-color-scheme: dark)");
        if (m && m.addEventListener) m.addEventListener("change", applyThemeFlag);
    }
} catch (e) {}

function ensureClickLayer() {
    if (!document.body) return;
    if (!clickLayerEl) {
        clickLayerEl = document.createElement("div");
        clickLayerEl.id = "ai-tester-click-layer";
    }
    if (clickLayerEl.parentElement !== document.body || clickLayerEl.nextSibling) {
        document.body.appendChild(clickLayerEl);
    }
}

function showClickFeedback(x, y, ok, label) {
    ensureClickLayer();
    const pulse = document.createElement("div");
    pulse.className = "ai-tester-click-pulse";
    pulse.style.left = `${x}px`;
    pulse.style.top = `${y}px`;
    clickLayerEl.appendChild(pulse);

    const text = document.createElement("div");
    text.className = "ai-tester-click-text";
    text.style.left = `${x}px`;
    text.style.top = `${y}px`;
    text.textContent = label || (ok ? "已记录" : "未记录");
    try {
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            text.classList.add("ai-dark");
        }
    } catch (e) {}
    clickLayerEl.appendChild(text);

    window.setTimeout(() => {
        try { pulse.remove(); } catch (_) {}
        try { text.remove(); } catch (_) {}
    }, 850);
}

function ensureOverlay() {
    if (!document.body) return;
    if (!overlayEl) {
        overlayEl = document.createElement("div");
        overlayEl.id = "ai-tester-overlay";

        const header = document.createElement("div");
        header.className = "ai-header";

        const title = document.createElement("div");
        title.className = "ai-title";

        const logo = document.createElement("div");
        logo.className = "ai-logo";
        logo.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <path d="m7 11 2-2-2-2"></path>
            <path d="M11 13h6"></path>
          </svg>
        `;

        overlayDotEl = document.createElement("div");
        overlayDotEl.className = "ai-dot";

        const titleText = document.createElement("div");
        titleText.className = "ai-title-text";
        titleText.textContent = "SOLO AI 录制器";

        title.appendChild(logo);
        title.appendChild(titleText);
        title.appendChild(overlayDotEl);

        const minBtn = document.createElement("button");
        minBtn.className = "ai-min-btn";
        minBtn.type = "button";
        minBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"></path>
          </svg>
        `;
        minBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            overlayEl.classList.toggle("ai-minimized");
        });

        header.appendChild(title);
        header.appendChild(minBtn);

        const body = document.createElement("div");
        body.className = "ai-body";

        const row = document.createElement("div");
        row.className = "ai-row";
        overlayStatusEl = document.createElement("div");
        overlayStatusEl.innerHTML = `状态：<strong>未开始</strong>`;
        overlayCountEl = document.createElement("div");
        overlayCountEl.innerHTML = `动作：<strong>0</strong>`;
        row.appendChild(overlayStatusEl);
        row.appendChild(overlayCountEl);

        overlayLastEl = document.createElement("div");
        overlayLastEl.className = "ai-last";
        overlayLastEl.textContent = "等待录制动作…";

        body.appendChild(row);
        body.appendChild(overlayLastEl);

        overlayEl.appendChild(header);
        overlayEl.appendChild(body);

        overlayEl.classList.add("ai-tester-hidden");

        header.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            const rect = overlayEl.getBoundingClientRect();
            dragState = {
                startX: e.clientX,
                startY: e.clientY,
                startLeft: rect.left,
                startTop: rect.top,
            };
            overlayEl.style.left = `${rect.left}px`;
            overlayEl.style.top = `${rect.top}px`;
            overlayEl.style.right = "auto";
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener("mousemove", (e) => {
            if (!dragState || !overlayEl) return;
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            const nextLeft = Math.max(8, dragState.startLeft + dx);
            const nextTop = Math.max(8, dragState.startTop + dy);
            overlayEl.style.left = `${nextLeft}px`;
            overlayEl.style.top = `${nextTop}px`;
        });

        document.addEventListener("mouseup", () => {
            dragState = null;
        });
    }
    
    if (overlayEl.parentElement !== document.body || overlayEl.nextSibling) {
        document.body.appendChild(overlayEl);
    }

    try {
        const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        overlayEl.classList.toggle("ai-dark", !!isDark);
    } catch (e) {}
}

function updateOverlay() {
    if (!overlayEl || !overlayDotEl || !overlayStatusEl || !overlayCountEl || !overlayLastEl) return;
    overlayEl.classList.toggle("ai-tester-hidden", !isRecording);
    overlayDotEl.classList.toggle("ai-on", !!isRecording);
    overlayStatusEl.innerHTML = `状态：<strong>${isRecording ? "录制中" : "未开始"}</strong>`;
    overlayCountEl.innerHTML = `动作：<strong>${actionCount}</strong>`;
    overlayLastEl.textContent = lastRecordedText || "等待录制动作…";
}

function getCssSelector(el) {
    if (el.tagName.toLowerCase() === "html") return "html";
    let path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName.toLowerCase() !== 'html') {
        let selector = current.tagName.toLowerCase();
        
        // 优先使用测试专属属性
        const testIds = ['data-testid', 'data-test-id', 'test-id', 'data-qa'];
        let foundTestId = false;
        for (const attr of testIds) {
            if (current.hasAttribute(attr)) {
                selector = `[${attr}="${CSS.escape(current.getAttribute(attr))}"]`;
                path.unshift(selector);
                foundTestId = true;
                break;
            }
        }
        if (foundTestId) break;

        // 使用稳定的 ID
        if (current.id && /^[a-zA-Z0-9_-]+$/.test(current.id) && !/\d{3,}/.test(current.id)) {
            selector = '#' + CSS.escape(current.id);
            path.unshift(selector);
            break; // 有了唯一 ID 就不需要再往上了
        }

        // 使用 class (排除动态态或无意义的 class)
        if (current.className && typeof current.className === 'string') {
            const classes = current.className.trim().split(/\s+/).filter(c => 
                !c.includes('ai-tester') && 
                !c.includes('hover:') && 
                !c.includes('focus:') &&
                !c.includes('active')
            );
            if (classes.length > 0) {
                // 最多取前两个 class，避免选择器过长
                selector += "." + classes.slice(0, 2).map(c => CSS.escape(c)).join(".");
            }
        }

        // 处理同级元素的 nth-of-type (只有在没有 id 的情况下才加，保证唯一性)
        if (path.length > 0 || current === el) {
            let sibling = current.parentNode ? current.parentNode.firstElementChild : null;
            let index = 1;
            let hasSameTagSibling = false;
            while (sibling) {
                if (sibling !== current && sibling.tagName === current.tagName) {
                    hasSameTagSibling = true;
                }
                if (sibling === current) break;
                if (sibling.tagName === current.tagName) index++;
                sibling = sibling.nextElementSibling;
            }
            if (hasSameTagSibling) {
                selector += `:nth-of-type(${index})`;
            }
        }
        
        path.unshift(selector);
        current = current.parentNode;
        
        // 为了避免选择器太长，最多向上找 3 层
        if (path.length >= 3) break;
    }
    return path.join(' > ');
}

async function captureSnapshot(element) {
    if (typeof html2canvas === 'undefined') return null;
    try {
        const canvas = await html2canvas(document.body, {
            x: window.scrollX + element.getBoundingClientRect().left - 50,
            y: window.scrollY + element.getBoundingClientRect().top - 50,
            width: Math.max(element.getBoundingClientRect().width + 100, 100),
            height: Math.max(element.getBoundingClientRect().height + 100, 100),
            useCORS: true
        });
        return canvas.toDataURL("image/jpeg", 0.7);
    } catch (e) {
        console.error("截图失败", e);
        return null;
    }
}

// 防抖计时器，防止短时间内触发多次记录
let lastActionTime = 0;
const ACTION_DEBOUNCE_MS = 500;

document.addEventListener('click', async (e) => {
    if (!isRecording) return;
    
    // 忽略我们自己的浮层（虽然现在移除了，但为了安全保留逻辑）
    if (e.target.closest('#ai-tester-overlay')) return;
    
    // 防抖：如果点击太快，忽略
    const now = Date.now();
    if (now - lastActionTime < ACTION_DEBOUNCE_MS) return;
    lastActionTime = now;
    
    // 提取元素信息，但不阻断用户原生点击！
    const target = e.target;
    const cx = e.clientX;
    const cy = e.clientY;
    
    if (target.tagName === 'TEXTAREA') {
        showClickFeedback(cx, cy, false, "输入后会记录");
        return;
    }
    if (target.tagName === 'SELECT' || target.tagName === 'OPTION') {
        showClickFeedback(cx, cy, false, "选择后会记录");
        return;
    }
    if (target.tagName === 'INPUT' && ['checkbox', 'radio'].includes(target.type)) {
        showClickFeedback(cx, cy, false, "选择后会记录");
        return;
    }
    if (target.tagName === 'INPUT' && ['text', 'password', 'email', 'number', 'search', 'tel', 'url'].includes(target.type)) {
        showClickFeedback(cx, cy, false, "输入后会记录");
        return;
    }
    
    const selector = getCssSelector(target);
    showClickFeedback(cx, cy, true, "记录中…");
    
    // 给元素闪烁一下红框，提示用户“记录成功”
    target.classList.add('ai-tester-highlight');
    setTimeout(() => {
        target.classList.remove('ai-tester-highlight');
    }, 500);
    
    // 尝试获取可读的文字用于 intent
    let text = target.innerText ? target.innerText.trim() : '';
    if (!text && target.value) text = target.value;
    if (!text && target.placeholder) text = target.placeholder;
    if (!text && target.getAttribute('aria-label')) text = target.getAttribute('aria-label');
    text = text.substring(0, 20).replace(/\n/g, ' '); // 截断避免太长
    
    const intentName = text ? `点击 "${text}"` : `点击 ${target.tagName.toLowerCase()}`;

    // 异步去截图并发送，绝对不卡主线程
    captureSnapshot(target).then(snapshot => {
        const action = {
            type: "click",
            selector: selector,
            value: null,
            intent: intentName, // 默认意图，优化为带文本内容
            snapshot: snapshot,
            url: window.location.href
        };
        chrome.runtime.sendMessage({ type: "ADD_ACTION", action: action }, (res) => {
            const ok = res && (res.status === "action_added" || res.status === "action_updated");
            lastRecordedText = `✅ ${intentName}`;
            ensureOverlay();
            updateOverlay();
            showClickFeedback(cx, cy, ok, ok ? "已记录" : "未记录");
        });
    });
    
}, true); // 使用捕获阶段

// 使用 input/change 事件，加一点防抖处理避免重复触发
let inputTimeout = null;
let lastInputTarget = null;

function getReadableLabel(el) {
    try {
        if (!el) return "";
        if (el.getAttribute && el.getAttribute('aria-label')) return el.getAttribute('aria-label');
        if (el.placeholder) return el.placeholder;
        if (el.name) return el.name;
        if (el.id) {
            const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (label && label.innerText) return label.innerText.trim();
        }
        const parentLabel = el.closest ? el.closest('label') : null;
        if (parentLabel && parentLabel.innerText) return parentLabel.innerText.trim();
        return "";
    } catch (e) {
        return "";
    }
}
document.addEventListener('input', async (e) => {
    if (!isRecording) return;
    if (e.target.closest('#ai-tester-overlay')) return;

    if (e.target.closest('#ai-tester-overlay')) return;

    const target = e.target;
    const isEditable = target && (target.isContentEditable || target.getAttribute && target.getAttribute('contenteditable') === 'true');
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !isEditable) return;
    if (target.tagName === 'INPUT' && !['text', 'password', 'email', 'number', 'search', 'tel', 'url'].includes(target.type)) return;

    const cx = e.clientX;
    const cy = e.clientY;
    lastInputTarget = target;

    if (inputTimeout) window.clearTimeout(inputTimeout);
    inputTimeout = window.setTimeout(() => {
        if (!lastInputTarget) return;
        const selector = getCssSelector(lastInputTarget);
        const value = (lastInputTarget.value !== undefined ? lastInputTarget.value : (lastInputTarget.innerText || '')).trim();
        let text = getReadableLabel(lastInputTarget) || lastInputTarget.tagName.toLowerCase();
        const intentName = `在 "${text}" 中输入内容`;
        captureSnapshot(lastInputTarget).then(snapshot => {
            const action = {
                type: "input",
                selector: selector,
                value: value,
                intent: intentName,
                snapshot: snapshot,
                url: window.location.href
            };
            chrome.runtime.sendMessage({ type: "ADD_ACTION", action: action }, (res) => {
                const ok = res && (res.status === "action_added" || res.status === "action_updated");
                lastRecordedText = `✅ ${intentName}`;
                ensureOverlay();
                updateOverlay();
                showClickFeedback(cx, cy, ok, ok ? "已记录" : "未记录");
            });
        });
    }, 650);
}, true);

document.addEventListener('change', async (e) => {
    if (!isRecording) return;
    if (e.target.closest('#ai-tester-overlay')) return;
    
    const target = e.target;
    if (target.tagName === 'INPUT' && ['checkbox', 'radio'].includes(target.type)) {
        const selector = getCssSelector(target);
        const checked = !!target.checked;
        const cx = e.clientX;
        const cy = e.clientY;
        target.classList.add('ai-tester-highlight');
        setTimeout(() => {
            target.classList.remove('ai-tester-highlight');
        }, 500);
        const labelText = getReadableLabel(target) || target.name || target.id || target.tagName.toLowerCase();
        const intentName = checked ? `勾选 "${labelText}"` : `取消勾选 "${labelText}"`;
        captureSnapshot(target).then(snapshot => {
            const action = {
                type: "set_checked",
                selector: selector,
                value: checked,
                intent: intentName,
                snapshot: snapshot,
                url: window.location.href
            };
            chrome.runtime.sendMessage({ type: "ADD_ACTION", action: action }, (res) => {
                const ok = res && (res.status === "action_added" || res.status === "action_updated");
                lastRecordedText = `✅ ${intentName}`;
                ensureOverlay();
                updateOverlay();
                showClickFeedback(cx, cy, ok, ok ? "已记录" : "未记录");
            });
        });
        return;
    }
    if (target.tagName !== 'SELECT') return;
    
    const selector = getCssSelector(target);
    const value = target.value;
    const cx = e.clientX;
    const cy = e.clientY;
    
    target.classList.add('ai-tester-highlight');
    setTimeout(() => {
        target.classList.remove('ai-tester-highlight');
    }, 500);
    
    let text = getReadableLabel(target) || target.tagName.toLowerCase();
    const optText = target.selectedOptions && target.selectedOptions[0] ? target.selectedOptions[0].textContent.trim() : value;
    const intentName = `在 "${text}" 中选择 "${String(optText || value).substring(0, 30)}"`;
    
    captureSnapshot(target).then(snapshot => {
        const action = {
            type: "select_option",
            selector: selector,
            value: value,
            intent: intentName, 
            snapshot: snapshot,
            url: window.location.href
        };
        chrome.runtime.sendMessage({ type: "ADD_ACTION", action: action }, (res) => {
            const ok = res && (res.status === "action_added" || res.status === "action_updated");
            lastRecordedText = `✅ ${intentName}`;
            ensureOverlay();
            updateOverlay();
            showClickFeedback(cx, cy, ok, ok ? "已记录" : "未记录");
        });
    });
}, true);

let lastNavHref = window.location.href;
function recordNavActions(nextHref) {
    const u = new URL(nextHref);
    const urlKey = (u.pathname || "/") + (u.search || "");
    const waitAction = {
        type: "wait",
        selector: "",
        value: "800",
        intent: "等待页面跳转",
        snapshot: null,
        url: nextHref
    };
    const assertAction = {
        type: "assert",
        assert_type: "url",
        selector: "",
        value: urlKey,
        intent: `断言 URL 包含 "${urlKey}"`,
        snapshot: null,
        url: nextHref
    };
    chrome.runtime.sendMessage({ type: "ADD_ACTION", action: waitAction }, () => {});
    chrome.runtime.sendMessage({ type: "ADD_ACTION", action: assertAction }, () => {});
    lastRecordedText = `✅ 路由跳转：${urlKey}`;
    ensureOverlay();
    updateOverlay();
}

try {
    const notify = () => window.dispatchEvent(new Event("ai-tester-location-change"));
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;
    history.pushState = function () {
        const r = _pushState.apply(this, arguments);
        notify();
        return r;
    };
    history.replaceState = function () {
        const r = _replaceState.apply(this, arguments);
        notify();
        return r;
    };
    window.addEventListener("popstate", notify);
    window.addEventListener("ai-tester-location-change", () => {
        if (!isRecording) return;
        const href = window.location.href;
        if (href === lastNavHref) return;
        lastNavHref = href;
        recordNavActions(href);
    });
} catch (e) {}
