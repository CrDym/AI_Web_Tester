// extension/popup/popup.js
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const clearBtn = document.getElementById('clear-btn');
    const statusText = document.getElementById('status-text');
    const actionCount = document.getElementById('action-count');

    function updateUI() {
        chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
            if (res && res.isRecording) {
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
            actionCount.textContent = res ? res.actionCount : 0;
        });
    }

    startBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: "START_RECORDING" }, () => updateUI());
    });

    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: "STOP_RECORDING" }, (res) => {
            updateUI();
            if (res && res.actions) {
                generatePythonScript(res.actions);
            } else {
                alert("获取录制数据失败。");
            }
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