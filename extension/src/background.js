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