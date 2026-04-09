// 页面注入脚本：抽取可交互元素并打上 ai-id，供自动化/大模型使用

/**
 * 注入到页面中，提取带有语义的交互元素。
 * 这大大减少了大模型的 Token 消耗。
 */
function extractInteractiveElements() {
    const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
    const interactiveRoles = ['button', 'link', 'checkbox', 'menuitem', 'option', 'tab'];
    
    // We also want to extract large text blocks for assertion purposes
    const contentTags = ['H1', 'H2', 'H3', 'P', 'STRONG', 'B', 'ARTICLE', 'SECTION'];
    
    let elementIdCounter = 1;
    const elements = [];
    
    function isInteractive(el) {
        if (interactiveTags.includes(el.tagName)) return true;
        const role = el.getAttribute('role');
        if (role && interactiveRoles.includes(role)) return true;
        if (el.onclick != null || el.getAttribute('ng-click') != null || el.getAttribute('@click') != null) return true;
        
        // Return true if it's a content tag with actual text, so the LLM can assert
        if (contentTags.includes(el.tagName) && el.innerText && el.innerText.trim().length > 0) return true;
        
        return false;
    }

    function isVisible(el) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return true;
    }

    function traverse(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (!isVisible(node)) return;

            if (isInteractive(node)) {
                // 打上 AI 专用的标记
                node.setAttribute('ai-id', elementIdCounter);
                
                elements.push({
                    id: elementIdCounter,
                    tag: node.tagName.toLowerCase(),
                    role: node.getAttribute('role') || '',
                    text: node.innerText ? node.innerText.trim().substring(0, 50) : '',
                    placeholder: node.getAttribute('placeholder') || '',
                    name: node.getAttribute('name') || '',
                    id_attr: node.getAttribute('id') || '',
                    type: node.getAttribute('type') || '',
                    bbox: node.getBoundingClientRect()
                });
                elementIdCounter++;
            }
            
            // 继续遍历子节点
            for (let child of node.childNodes) {
                traverse(child);
            }
        }
    }

    traverse(document.body);
    return { elements };
}

// 供 Playwright 调用
window.extractInteractiveElements = extractInteractiveElements;
