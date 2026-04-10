// 页面注入脚本：抽取可交互元素并打上 ai-id，供自动化/大模型使用

/**
 * 注入到页面中，提取带有语义的交互元素。
 * 这大大减少了大模型的 Token 消耗。
 */
function extractInteractiveElements(startId = 1) {
    const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'OPTION', 'TEXTAREA'];
    const interactiveRoles = ['button', 'link', 'checkbox', 'menuitem', 'option', 'tab'];
    
    // We also want to extract large text blocks for assertion purposes
    const contentTags = ['H1', 'H2', 'H3', 'P', 'STRONG', 'B', 'ARTICLE', 'SECTION', 'SPAN', 'DIV'];
    
    let elementIdCounter = startId;
    const elements = [];
    
    function isInteractive(el) {
        if (interactiveTags.includes(el.tagName)) return true;
        const role = el.getAttribute('role');
        if (role && interactiveRoles.includes(role)) return true;
        if (el.onclick != null || el.getAttribute('ng-click') != null || el.getAttribute('@click') != null) return true;
        
        // Return true if it's a content tag with actual text, so the LLM can assert
        if (contentTags.includes(el.tagName) && el.innerText && el.innerText.trim().length > 2 && el.children.length === 0) return true;
        
        return false;
    }

    function isVisible(el) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        
        // 核心优化：只提取在当前视口 (Viewport) 内的元素
        // 如果元素完全在屏幕外，则大模型暂时不需要看到它，极大地节省 Token
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        
        // 允许有一点点缓冲区域 (比如 100px)，防止刚好露出一半的元素被忽略
        const buffer = 100;
        
        // 判断是否与视口有交集
        const inViewport = (
            rect.top < windowHeight + buffer &&
            rect.bottom > -buffer &&
            rect.left < windowWidth + buffer &&
            rect.right > -buffer
        );
        
        return inViewport;
    }

    function getCssSelector(el) {
        if (el.tagName.toLowerCase() === 'html') return 'html';
        
        // 1. 优先使用测试专属属性
        const testIds = ['data-testid', 'data-test-id', 'test-id', 'data-qa'];
        for (const attr of testIds) {
            if (el.hasAttribute(attr)) {
                return `[${attr}="${CSS.escape(el.getAttribute(attr))}"]`;
            }
        }
        
        // 2. 使用 ID (如果是纯字母数字，避免复杂的随机 ID)
        if (el.id && /^[a-zA-Z0-9_-]+$/.test(el.id)) return '#' + CSS.escape(el.id);
        
        // 3. 使用特定的属性（如 name）
        if (el.getAttribute('name')) {
            return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.getAttribute('name'))}"]`;
        }
        
        // 4. 尝试使用文本定位 (Playwright 兼容的 CSS 扩展伪类 :has-text)
        if (['BUTTON', 'A', 'SPAN', 'DIV'].includes(el.tagName)) {
            const text = el.innerText ? el.innerText.trim() : '';
            if (text.length > 0 && text.length < 20 && !text.includes('\n')) {
                return `${el.tagName.toLowerCase()}:has-text("${text}")`;
            }
        }

        // 5. Fallback 到结构路径
        let path = [];
        let current = el;
        while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName.toLowerCase() !== 'html') {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
                selector = '#' + CSS.escape(current.id);
                path.unshift(selector);
                break;
            } else {
                let sibling = current.parentNode ? current.parentNode.firstElementChild : null;
                let index = 1;
                while (sibling) {
                    if (sibling === current) break;
                    if (sibling.tagName === current.tagName) index++;
                    sibling = sibling.nextElementSibling;
                }
                selector += `:nth-of-type(${index})`;
                path.unshift(selector);
            }
            current = current.parentNode;
        }
        return path.join(' > ');
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
                    css_selector: getCssSelector(node),
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
