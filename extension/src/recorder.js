// extension/src/recorder.js
let isRecording = false;

// 轮询同步后台状态
setInterval(() => {
    try {
        chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
            if (res && res.isRecording !== undefined) {
                isRecording = res.isRecording;
            }
        });
    } catch (e) {
        // 如果插件重新加载了，连接可能会断开
    }
}, 1000);

function getCssSelector(el) {
    if (el.tagName.toLowerCase() === "html") return "html";
    let selector = el.tagName.toLowerCase();
    if (el.id) {
        selector += "#" + el.id;
        return selector; // 优先使用 ID
    }
    if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\s+/).filter(c => !c.includes('ai-tester'));
        if (classes.length > 0) {
            selector += "." + classes.join(".");
        }
    }
    return selector;
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
    const selector = getCssSelector(target);
    
    // 给元素闪烁一下红框，提示用户“记录成功”
    target.classList.add('ai-tester-highlight');
    setTimeout(() => {
        target.classList.remove('ai-tester-highlight');
    }, 500);
    
    // 异步去截图并发送，绝对不卡主线程
    captureSnapshot(target).then(snapshot => {
        const action = {
            type: "click",
            selector: selector,
            value: null,
            intent: `点击 ${target.tagName.toLowerCase()}`, // 默认意图，后续让用户在插件面板里统一补充
            snapshot: snapshot,
            url: window.location.href
        };
        chrome.runtime.sendMessage({ type: "ADD_ACTION", action: action });
    });
    
}, true); // 使用捕获阶段

document.addEventListener('change', async (e) => {
    if (!isRecording) return;
    if (e.target.closest('#ai-tester-overlay')) return;
    
    const target = e.target;
    const selector = getCssSelector(target);
    const value = target.value;
    
    target.classList.add('ai-tester-highlight');
    setTimeout(() => {
        target.classList.remove('ai-tester-highlight');
    }, 500);
    
    captureSnapshot(target).then(snapshot => {
        const action = {
            type: "input",
            selector: selector,
            value: value,
            intent: `在 ${target.tagName.toLowerCase()} 中输入 ${value}`, 
            snapshot: snapshot,
            url: window.location.href
        };
        chrome.runtime.sendMessage({ type: "ADD_ACTION", action: action });
    });
}, true);