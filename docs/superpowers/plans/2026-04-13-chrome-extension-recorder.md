# AI Tester Chrome 插件录制器 实现计划

> **给 Agent 的提示：** 必须使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 按任务逐步实现此计划。请使用 Markdown 的复选框 (`- [ ]`) 语法跟踪进度。

**目标:** 构建一个 Chrome 扩展程序，用于记录用户在网页上的 UI 交互（点击、输入），同时弹窗要求用户输入自然语言意图，并截取元素周围的局部截图，最终导出为可供 `AITesterAgent` 运行的 Python Playwright 测试脚本。

**架构:** 
- 标准的 Chrome 扩展 (Manifest V3)。
- **Popup UI (弹窗界面)**: 控制录制的开始/停止，以及下载生成的 Python 脚本。
- **Content Script (`recorder.js`)**: 注入到每个网页中，监听 `click` 和 `change`/`input` 事件。当事件发生时，拦截动作，弹出一个输入框询问用户的“意图”，截取元素周围 100x100 的截图，并将数据（选择器、意图、截图）发送给后台脚本。
- **Background Script (`background.js`)**: 维护录制状态，确保在页面跳转时数据不丢失。
- **脚本生成器**: 将录制好的 JSON 数据数组转换为带有 `SelfHealer` 自愈机制的 Playwright Python 脚本。

**技术栈:** HTML/CSS/JS (原生), Chrome Extension API (Manifest V3), html2canvas (用于本地截图)。

---

### 任务 1: 项目初始化与 Manifest V3 配置

**相关文件:**
- 创建: `extension/manifest.json`
- 创建: `extension/icons/icon16.png`, `extension/icons/icon48.png`, `extension/icons/icon128.png` (占位图)

- [ ] **步骤 1: 创建基础目录结构和占位图标**

```bash
mkdir -p extension/icons extension/src extension/popup extension/lib
touch extension/icons/icon16.png extension/icons/icon48.png extension/icons/icon128.png
```

- [ ] **步骤 2: 创建 Manifest V3 文件**

```json
{
  "manifest_version": 3,
  "name": "AI Tester Recorder",
  "version": "1.0",
  "description": "录制带有自然语言意图的 UI 交互，为 AI Web Tester 生成测试脚本",
  "permissions": [
    "activeTab",
    "storage",
    "scripting",
    "tabs"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "src/background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["lib/html2canvas.min.js", "src/recorder.js"],
      "css": ["src/recorder.css"]
    }
  ]
}
```

- [ ] **步骤 3: 下载 html2canvas 截图库**

```bash
curl -sL https://html2canvas.hertzen.com/dist/html2canvas.min.js -o extension/lib/html2canvas.min.js
```

- [ ] **步骤 4: 提交代码**

```bash
git add extension/
git commit -m "feat(extension): 初始化 manifest v3 和项目结构"
```

---

### 任务 2: Background 脚本与状态管理

**相关文件:**
- 创建: `extension/src/background.js`

- [ ] **步骤 1: 编写 background.js 以管理录制状态**

```javascript
// extension/src/background.js
let isRecording = false;
let recordedActions = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "START_RECORDING") {
        isRecording = true;
        recordedActions = [];
        sendResponse({ status: "started" });
    } else if (request.type === "STOP_RECORDING") {
        isRecording = false;
        sendResponse({ status: "stopped", actions: recordedActions });
    } else if (request.type === "GET_STATUS") {
        sendResponse({ isRecording, actionCount: recordedActions.length });
    } else if (request.type === "ADD_ACTION") {
        if (isRecording) {
            recordedActions.push(request.action);
            sendResponse({ status: "action_added" });
        }
    } else if (request.type === "CLEAR_ACTIONS") {
        recordedActions = [];
        sendResponse({ status: "cleared" });
    }
    return true; // 保持消息通道打开以支持异步响应
});
```

- [ ] **步骤 2: 提交代码**

```bash
git add extension/src/background.js
git commit -m "feat(extension): 增加 background 脚本处理全局状态"
```

---

### 任务 3: Popup 交互界面与 Python 脚本生成器

**相关文件:**
- 创建: `extension/popup/popup.html`
- 创建: `extension/popup/popup.js`
- 创建: `extension/popup/popup.css`

- [ ] **步骤 1: 创建 popup.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <h3>AI Tester 录制器</h3>
  <div class="status">
    状态: <span id="status-text">已停止</span>
  </div>
  <div class="actions">
    已录制动作: <span id="action-count">0</span>
  </div>
  <div class="buttons">
    <button id="start-btn">开始录制</button>
    <button id="stop-btn" disabled>停止并生成代码</button>
    <button id="clear-btn">清空</button>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **步骤 2: 创建 popup.css**

```css
body {
  width: 250px;
  font-family: Arial, sans-serif;
  padding: 10px;
}
.status, .actions {
  margin-bottom: 10px;
  font-size: 14px;
}
#status-text {
  font-weight: bold;
  color: red;
}
#status-text.recording {
  color: green;
}
.buttons button {
  width: 100%;
  margin-bottom: 5px;
  padding: 8px;
  cursor: pointer;
}
```

- [ ] **步骤 3: 创建 popup.js，包含核心代码生成逻辑**

```javascript
// extension/popup/popup.js
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const clearBtn = document.getElementById('clear-btn');
    const statusText = document.getElementById('status-text');
    const actionCount = document.getElementById('action-count');

    function updateUI() {
        chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
            if (res.isRecording) {
                statusText.textContent = "录制中...";
                statusText.className = "recording";
                startBtn.disabled = true;
                stopBtn.disabled = false;
            } else {
                statusText.textContent = "已停止";
                statusText.className = "";
                startBtn.disabled = false;
                stopBtn.disabled = true;
            }
            actionCount.textContent = res.actionCount;
        });
    }

    startBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: "START_RECORDING" }, () => updateUI());
    });

    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: "STOP_RECORDING" }, (res) => {
            updateUI();
            generatePythonScript(res.actions);
        });
    });

    clearBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: "CLEAR_ACTIONS" }, () => updateUI());
    });

    function generatePythonScript(actions) {
        if (actions.length === 0) return alert("没有录制到任何动作。");
        
        let script = `from ai_tester import PlaywrightDriver, AITesterAgent, SelfHealer\n\n`;
        script += `def test_recorded_flow(page):\n`;
        script += `    driver = PlaywrightDriver(page)\n`;
        script += `    agent = AITesterAgent(driver, use_vision=False, auto_vision=True)\n`;
        script += `    healer = SelfHealer(use_vision=True)\n\n`;
        
        actions.forEach((act, index) => {
            script += `    # Step ${index + 1}: ${act.intent}\n`;
            script += `    selector_${index} = "${act.selector}"\n`;
            script += `    try:\n`;
            if (act.type === "click") {
                script += `        page.click(selector_${index}, timeout=3000)\n`;
            } else if (act.type === "input") {
                script += `        page.fill(selector_${index}, "${act.value}", timeout=3000)\n`;
            }
            script += `    except Exception:\n`;
            script += `        current_dom = agent.get_dom_tree_str()\n`;
            script += `        screenshot = driver.get_screenshot()\n`;
            script += `        new_id = healer.heal(selector_${index}, "${act.intent}", current_dom, screenshot)\n`;
            script += `        if new_id:\n`;
            if (act.type === "click") {
                script += `            driver.perform_action("click", new_id)\n`;
            } else if (act.type === "input") {
                script += `            driver.perform_action("type", new_id, "${act.value}")\n`;
            }
            script += `        else:\n`;
            script += `            raise Exception("AI 自愈失败，无法完成步骤 ${index + 1}")\n\n`;
        });

        // 触发文件下载
        const blob = new Blob([script], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "test_recorded_flow.py";
        a.click();
    }

    updateUI();
});
```

- [ ] **步骤 4: 提交代码**

```bash
git add extension/popup/
git commit -m "feat(extension): 实现 popup UI 与 python 脚本生成逻辑"
```

---

### 任务 4: Content Script - 事件拦截与意图弹窗

**相关文件:**
- 创建: `extension/src/recorder.js`
- 创建: `extension/src/recorder.css`

- [ ] **步骤 1: 创建 recorder.css**

```css
/* extension/src/recorder.css */
#ai-tester-overlay {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 2px solid #1890ff;
    padding: 15px;
    z-index: 2147483647; /* 最高层级 */
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border-radius: 8px;
    font-family: sans-serif;
    width: 300px;
}
#ai-tester-overlay h4 { margin: 0 0 10px 0; font-size: 14px; color: #333; }
#ai-tester-overlay input { width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box; }
#ai-tester-overlay button { background: #1890ff; color: white; border: none; padding: 8px 12px; cursor: pointer; border-radius: 4px; width: 100%; }
#ai-tester-overlay button:hover { background: #40a9ff; }
.ai-tester-highlight { outline: 2px solid red !important; }
```

- [ ] **步骤 2: 创建 recorder.js**

```javascript
// extension/src/recorder.js
let isRecording = false;

// 轮询同步后台状态
setInterval(() => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
        if (res) isRecording = res.isRecording;
    });
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

        btn.addEventListener('click', async () => {
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
    
    const action = await showIntentPrompt("click", e.target);
    chrome.runtime.sendMessage({ type: "ADD_ACTION", action: action });
    
    // 注意：为了演示简单，录制阶段暂时阻断了真实的点击跳转，如果需要可以通过 JS 手动触发点击恢复执行
}, true); // 使用捕获阶段

document.addEventListener('change', async (e) => {
    if (!isRecording) return;
    if (e.target.closest('#ai-tester-overlay')) return;
    
    const action = await showIntentPrompt("input", e.target, e.target.value);
    chrome.runtime.sendMessage({ type: "ADD_ACTION", action: action });
}, true);
```

- [ ] **步骤 3: 提交代码**

```bash
git add extension/src/
git commit -m "feat(extension): 增加 content script 实现事件拦截与意图录制"
```