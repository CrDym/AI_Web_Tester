// 页面注入脚本：抽取可交互元素并打上 ai-id，供自动化/大模型使用

/**
 * 注入到页面中，提取带有语义的交互元素。
 * 这大大减少了大模型的 Token 消耗。
 */
function extractInteractiveElements(startId = 1) {
    const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'OPTION', 'TEXTAREA'];
    const interactiveRoles = ['button', 'link', 'checkbox', 'menuitem', 'option', 'tab', 'combobox', 'searchbox', 'switch', 'slider', 'listbox', 'treeitem'];
    
    // We also want to extract large text blocks for assertion purposes
    const contentTags = ['H1', 'H2', 'H3', 'P', 'STRONG', 'B', 'ARTICLE', 'SECTION', 'SPAN', 'DIV', 'LABEL'];
    
    let elementIdCounter = startId;
    const elements = [];
    
    function isInteractive(el) {
        if (interactiveTags.includes(el.tagName)) return true;
        const role = el.getAttribute('role');
        if (role && interactiveRoles.includes(role)) return true;
        if (el.onclick != null || el.getAttribute('ng-click') != null || el.getAttribute('@click') != null || el.getAttribute('v-on:click') != null) return true;
        
        // 增加现代前端框架的 className 判断
        const className = el.getAttribute('class') || '';
        const tagName = el.tagName.toLowerCase();
        
        // 增加自定义元素（Web Components / Angular等）的 tagName 判断
        if (tagName.includes('cf-') || tagName.includes('select') || tagName.includes('dropdown')) {
            return true;
        }

        if (typeof className === 'string') {
            const lowerClass = className.toLowerCase();
            if (lowerClass.includes('select') || 
                lowerClass.includes('input') ||
                lowerClass.includes('search') ||
                lowerClass.includes('dropdown') ||
                lowerClass.includes('cascader') ||
                lowerClass.includes('picker') ||
                lowerClass.includes('combo') ||
                lowerClass.includes('button') ||
                lowerClass.includes('btn') ||
                lowerClass.includes('cursor-pointer') ||
                lowerClass.includes('cf-') ||
                lowerClass.includes('ant-select-item') ||
                lowerClass.includes('option') ||
                lowerClass.includes('item') ||
                lowerClass.includes('selection')) {
                return true;
            }
            
            // 专门放开 cf-select-arrow 这类下拉箭头
            if (lowerClass.includes('arrow') || lowerClass.includes('icon') || lowerClass.includes('cf-select')) {
                return true;
            }
        }
        
        // 针对 Element/Antd 等框架包裹层的特殊处理：
        // 很多时候真正的 input 被隐藏了，而外层用一个没有点击事件的 div/span 伪装成输入框
        if (el.tagName === 'DIV' || el.tagName === 'SPAN') {
            // 如果内部有 placeholder 文字或者选中的文字，说明它承载了输入框的功能
            const text = el.innerText || '';
            if (text.includes('请选择') || text.includes('请输入')) return true;
            // 通过 placeholder 属性来判断
            if (el.getAttribute('placeholder')) return true;
        }

        // 强行把所有自定义标签（比如 <cf-select-arrow> 等）以及常见的输入相关的都作为交互元素
        if (el.tagName.toLowerCase().includes('cf-') || el.tagName.toLowerCase().includes('select') || el.tagName.toLowerCase().includes('input')) {
            return true;
        }

        // Return true if it's a content tag with actual text, so the LLM can assert
        // Relaxing the children.length === 0 constraint slightly to allow simple wrappers
        if (contentTags.includes(el.tagName) && el.innerText && el.innerText.trim().length > 2) {
            // If it has too many children, it's a layout container, not a leaf content node
            if (el.children.length <= 1) return true;
        }
        
        return false;
    }

    function isVisible(el) {
        const style = window.getComputedStyle(el);
        
        // Many modern UI frameworks (like Antd/Element) use opacity: 0 on inputs to hide the native caret
        // but keep them functional. We should not filter out inputs with opacity 0 if they have dimensions.
        // 注意：有些组件会把包裹层甚至下拉箭头的透明度设为 0 但是通过其他方式显示，所以我们放宽条件
        if (style.opacity === '0' || style.visibility === 'hidden') {
             // 绝对宽容：如果是我们怀疑的输入框或箭头，即便被标记为透明或隐藏，只要它有长宽，我们就把它捞出来
             if (el.tagName === 'INPUT' || 
                 el.tagName.toLowerCase().includes('cf-') || 
                 el.getAttribute('class')?.includes('input') || 
                 el.getAttribute('class')?.includes('select') ||
                 el.getAttribute('class')?.includes('arrow')) {
                 // 放行
             } else {
                 return false;
             }
        }
        
        if (style.display === 'none') return false;
        
        const rect = el.getBoundingClientRect();
        
        // 特殊放宽：有些前端组件的 input 或 arrow 宽高可能被挤压得很小，但依然承载了点击唤起下拉框的职责
        if (el.tagName === 'INPUT' || 
            el.tagName.toLowerCase().includes('cf-') || 
            el.getAttribute('class')?.includes('arrow') || 
            el.getAttribute('class')?.includes('cf-select')) {
            // 彻底移除对 0 尺寸的强制过滤，允许提取纯伪元素绘制的箭头或者被框架压缩的 input
            return true;
        }

        // 常规元素依然过滤掉宽高为 0 的
        if (rect.width === 0 || rect.height === 0) return false;
        
        // 在不使用 viewport 过滤的情况下，依然要过滤掉实际上不可见的超小元素
        if (rect.width < 1 || rect.height < 1) return false;
        
        return true;
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
        // 避免模糊匹配，对于纯文本节点，我们最好使用精确匹配
        if (['BUTTON', 'A', 'SPAN', 'DIV', 'LABEL'].includes(el.tagName)) {
            const text = el.innerText ? el.innerText.trim() : '';
            if (text.length > 0 && text.length < 20 && !text.includes('\n')) {
                // 使用 text= 精确匹配而不是包含匹配，防止点到外层大容器
                // 但是对于一些复杂框架的内部嵌套，text= 可能找不准。
                // 保留旧版本的 text 匹配逻辑
                return `text="${text}"`;
            }
        }

        // 5. Fallback 到结构路径
        let path = [];
        let current = el;
        while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName.toLowerCase() !== 'html') {
            let selector = current.tagName.toLowerCase();
            // 过滤掉前端框架动态生成的长串数字 ID (如 el-popper-1234)
            if (current.id && /^[a-zA-Z0-9_-]+$/.test(current.id) && !/\d{3,}/.test(current.id)) {
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
            // 这里非常关键：不能因为节点不可见就直接 return 截断子节点遍历
            // 因为有些包裹层 div 只是用于绝对定位，其尺寸为 0 甚至透明，但里面的真实内容是可见的
            const visible = isVisible(node);
            
            // 只有当 display: none 时，子节点才必定不可见，此时可以安全截断
            if (window.getComputedStyle(node).display === 'none') {
                return;
            }

            let extracted = false;
            // 仅当节点自身可见且具有交互性时才提取
            if (visible && isInteractive(node)) {
                // 打上 AI 专用的标记
                node.setAttribute('ai-id', elementIdCounter);
                
                const rect = node.getBoundingClientRect();
                
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
                    bbox: {
                        // 只需要视口坐标，因为 screenshot(full_page=False) 截取的是当前视口
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height
                    }
                });
                elementIdCounter++;
                extracted = true;
            }
            
            // 优化：如果当前节点已经被提取了（比如一个包含完整文本的 button），
            // 就没有必要再去深挖它的内部 span 节点了，防止产生层层嵌套的“俄罗斯套娃红框”
            if (extracted && ['BUTTON', 'A', 'OPTION'].includes(node.tagName)) {
                return;
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
