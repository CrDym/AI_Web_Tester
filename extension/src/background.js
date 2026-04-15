// extension/src/background.js
let isRecording = false;
let recordedActions = [];

function broadcastStatus() {
    chrome.tabs.query({}, (tabs) => {
        for (const t of tabs || []) {
            if (!t || !t.id) continue;
            try {
                chrome.tabs.sendMessage(t.id, { type: "STATUS_UPDATE", isRecording, actionCount: recordedActions.length }, () => {
                    let _ = chrome.runtime.lastError;
                });
            } catch (e) {}
        }
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "START_RECORDING") {
        isRecording = true;
        recordedActions = [];
        broadcastStatus();
        sendResponse({ status: "started" });
    } else if (request.type === "STOP_RECORDING") {
        isRecording = false;
        broadcastStatus();
        sendResponse({ status: "stopped", actions: recordedActions });
    } else if (request.type === "GET_STATUS") {
        sendResponse({ isRecording, actionCount: recordedActions.length });
    } else if (request.type === "ADD_ACTION") {
        if (isRecording) {
            // 简单的防抖去重：如果最后一个动作和当前动作相同，则合并（例如连续触发 input/change）
            if (recordedActions.length > 0) {
                const lastAction = recordedActions[recordedActions.length - 1];
                if (lastAction.type === "input" && request.action.type === "input" && lastAction.selector === request.action.selector) {
                    lastAction.value = request.action.value; // 更新最后输入的值
                    broadcastStatus();
                    sendResponse({ status: "action_updated" });
                    return true;
                }
            }
            recordedActions.push(request.action);
            broadcastStatus();
            sendResponse({ status: "action_added" });
        }
    } else if (request.type === "CLEAR_ACTIONS") {
        recordedActions = [];
        broadcastStatus();
        sendResponse({ status: "cleared" });
    }
    return true; // 保持消息通道打开以支持异步响应
});
