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

function showIntentPrompt(actionType, targetElement, value = null) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.id = "ai-tester-overlay";
        
        const title = document.createElement('h4');
        title.textContent = `动作: ${actionType.toUpperCase()} - 请输入操作意图`;
        
        const input = document.createElement('input');
        input.type = "text";
        input.placeholder = "例如: 点击登录按钮 / 输入用户名";
        
        const btn = document.createElement('button');
        btn.textContent = "保存动作";
        
        overlay.appendChild(title);
        overlay.appendChild(input);
        overlay.appendChild(btn);
        document.body.appendChild(overlay);
        
        targetElement.classList.add('ai-tester-highlight');
        input.focus();

        // 支持按回车键保存
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });

        btn.addEventListener('click', async (event) => {
            // 阻止点击事件冒泡，防止触发全局的点击拦截
            event.preventDefault();
            event.stopPropagation();
            
            const intent = input.value.trim() || `执行 ${actionType}`;
            targetElement.classList.remove('ai-tester-highlight');
            document.body.removeChild(overlay);
            
            const selector = getCssSelector(targetElement);
            const snapshot = await captureSnapshot(targetElement);
            
            resolve({
                type: actionType,
                selector: selector,
                value: value,
                intent: intent,
                snapshot: snapshot,
                url: window.location.href
            });
        });
    });
}

document.addEventListener('click', async (e) => {
    if (!isRecording) return;
    // 忽略点击录制器弹窗本身
    if (e.target.closest('#ai-tester-overlay')) return;
    
    // 拦截点击事件，等待用户输入意图
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // 保存真实的点击目标
    const target = e.target;
    
    const action = await showIntentPrompt("click", target);
    chrome.runtime.sendMessage({ type: "ADD_ACTION", action: action });
    
    // 录制完成后，释放记录状态一瞬间，让真实的点击通过，然后再恢复记录状态
    // 这样就不会阻断用户的业务流程
    const wasRecording = isRecording;
    isRecording = false;
    target.click();
    isRecording = wasRecording;
    
}, true); // 使用捕获阶段

document.addEventListener('change', async (e) => {
    if (!isRecording) return;
    if (e.target.closest('#ai-tester-overlay')) return;
    
    const action = await showIntentPrompt("input", e.target, e.target.value);
    chrome.runtime.sendMessage({ type: "ADD_ACTION", action: action });
}, true);