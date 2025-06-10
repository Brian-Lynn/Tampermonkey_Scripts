// ==UserScript==
// @name         AI平台_Web体验优化 v5.1
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  1.阻止enter发送行为，改为ctrl+enter组合键发送，防止误发送浪费ai次数/token。2.对于数学/物理等公式，支持点击复制latex代码，防止格式错乱（gemini暂不支持）。
// @author       0xbbbb
// @match        https://chatgpt.com/*
// @match        https://chat.deepseek.com/*
// @match        https://chat.qwen.ai/*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @match        https://grok.com/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const currentHostname = window.location.hostname;

    // --- 模块一：公式复制器 ---
    // 目标：方便地从渲染后的数学公式中提取并复制其 LaTeX 源码。
    // 策略：通过 MutationObserver 监控页面动态加载的公式，并为其绑定点击事件。
    // 排除范围：在 Gemini 和 Claude 上禁用，以避免潜在的兼容性问题或功能冗余。
    if (!currentHostname.includes('gemini.google.com') && !currentHostname.includes('claude.ai')) {
        (function FormulaCopier() {
            console.log("模块【公式复制器】: 已启动。");

            // 注入UI样式：选中效果和复制成功反馈提示
            GM_addStyle(`
                .formula-copier-selected {
                    outline: 2px solid #4A90E2 !important; /* 蓝色高亮轮廓 */
                    border-radius: 5px;
                    cursor: pointer;
                    box-shadow: 0 0 5px rgba(74, 144, 226, 0.5);
                }
                .formula-copier-feedback {
                    position: absolute;
                    background-color: #4A90E2;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    z-index: 10001;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
                    transform: translateY(10px);
                }
                .formula-copier-feedback.visible {
                    opacity: 1;
                    transform: translateY(0);
                }
            `);

            let selectedElement = null; // 存储当前被选中的公式元素

            /**
             * 在元素上方显示“已复制”的反馈提示。
             * @param {HTMLElement} element - 显示提示的目标元素。
             */
            function showCopyFeedback(element) {
                const rect = element.getBoundingClientRect();
                const feedback = document.createElement('div');
                feedback.textContent = '已复制!';
                feedback.classList.add('formula-copier-feedback');
                document.body.appendChild(feedback);

                // 计算提示框的位置，使其位于元素正上方
                const fbLeft = window.scrollX + rect.left + rect.width / 2 - feedback.offsetWidth / 2;
                const fbTop = window.scrollY + rect.top - feedback.offsetHeight - 8;
                feedback.style.left = `${fbLeft}px`;
                feedback.style.top = `${fbTop}px`;

                // 触发显示动画并定时移除
                setTimeout(() => {
                    feedback.classList.add('visible');
                }, 10);
                setTimeout(() => {
                    feedback.style.opacity = '0';
                    feedback.style.transform = 'translateY(10px)';
                    setTimeout(() => feedback.remove(), 300);
                }, 1500);
            }

            /**
             * 清除当前选中的公式的高亮状态。
             */
            function clearSelection() {
                if (selectedElement) {
                    selectedElement.classList.remove('formula-copier-selected');
                    selectedElement = null;
                }
            }

            /**
             * 从公式容器元素中提取 LaTeX 源码。
             * @param {HTMLElement} containerElement - 包含 LaTeX 源码的父元素。
             * @returns {string|null} 提取到的 LaTeX 源码，或在未找到时返回 null。
             */
            function getLatexSource(containerElement) {
                // 兼容 KaTeX 和 MathJax 的源码存储方式
                const annotation = containerElement.querySelector('annotation[encoding="application/x-tex"], annotation[encoding="text/x-latex"]');
                if (annotation && annotation.textContent) {
                    // 清理字符串，移除多余的 \tag
                    return annotation.textContent.trim().replace(/\s*\\tag\{.*\}/, '').trim();
                }
                return null;
            }

            /**
             * 处理公式的点击事件。
             * 第一次点击：选中公式。
             * 第二次点击（相同公式）：复制 LaTeX 源码并取消选中。
             * @param {MouseEvent} event - 点击事件对象。
             */
            function handleFormulaClick(event) {
                event.stopPropagation(); // 防止事件冒泡干扰页面其他功能
                const target = event.currentTarget;

                if (target === selectedElement) {
                    // 第二次点击：复制并清除
                    const latex = getLatexSource(target);
                    if (latex) {
                        GM_setClipboard(latex);
                        showCopyFeedback(target);
                    }
                    clearSelection();
                } else {
                    // 第一次点击：清除旧的，选中新的
                    clearSelection();
                    selectedElement = target;
                    selectedElement.classList.add('formula-copier-selected');
                }
            }

            /**
             * 在指定的根节点下查找并为所有公式元素绑定点击事件。
             * @param {Node} rootNode - 开始搜索的 DOM 节点。
             */
            function findAndBind(rootNode) {
                if (rootNode.nodeType !== Node.ELEMENT_NODE) return;

                // 查找 KaTeX 或 MathJax 渲染的公式容器
                const formulas = rootNode.querySelectorAll('.katex, .katex-display, .mjx-container');
                formulas.forEach(formula => {
                    // 添加标记以避免重复绑定
                    if (formula.dataset.formulaCopierAttached) return;
                    if (formula.closest('[data-formula-copier-attached="true"]')) return; // 避免子元素重复绑定

                    formula.dataset.formulaCopierAttached = 'true';
                    formula.addEventListener('click', handleFormulaClick);
                });
            }

            // 使用 MutationObserver 监听整个文档，以处理动态加载的内容（如AI的流式输出）
            const observer = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach(node => findAndBind(node));
                    }
                }
            });

            // 初始执行一次，并启动监听
            findAndBind(document.body);
            observer.observe(document.body, { childList: true, subtree: true });

            // 添加全局点击事件监听器，用于取消公式选中状态
            document.addEventListener('click', (event) => {
                if (selectedElement && !selectedElement.contains(event.target)) {
                    clearSelection();
                }
            }, true);
        })();
    }


    // --- 模块二：回车/Ctrl+Enter 增强 ---
    // 目标：统一所有支持的 AI 网站的快捷键行为。
    // 策略：拦截原生的 Enter 键事件。将“单独按 Enter”映射为换行，将“Ctrl+Enter”映射为发送。
    //       使用事件捕获阶段进行监听，确保最高优先级，防止被网站自身的脚本覆盖。
    (function EnterNoSendUnified() {
        console.log("模块【回车增强】: 采用2.1.js核心逻辑，已启动。");

        const SCRIPT_NAME = 'AIChatEnhancer-EnterNoSend';
        const hostname = window.location.hostname;

        /**
         * 辅助函数：创建一个可配置的键盘事件。
         * @param {string} type - 事件类型, 'keydown' 或 'keyup'.
         * @param {object} options - 按键事件的配置 (key, code, keyCode, shiftKey 等).
         * @returns {KeyboardEvent}
         */
        function createKeyEvent(type, options) {
            const event = new KeyboardEvent(type, {
                key: options.key || 'Enter',
                code: options.code || 'Enter',
                keyCode: options.keyCode || 13,
                which: options.which || 13,
                shiftKey: !!options.shiftKey,
                ctrlKey: !!options.ctrlKey,
                altKey: !!options.altKey,
                metaKey: !!options.metaKey,
                bubbles: true,
                cancelable: true
            });
            // 添加一个自定义属性，用于识别是脚本自身派发的事件，避免无限循环
            Object.defineProperty(event, 'isTriggeredByScript', { value: true, writable: false });
            return event;
        }

        // 在捕获阶段添加事件监听器，以确保最高优先级
        document.addEventListener('keydown', (e) => {
            // 如果是脚本自己触发的事件，则直接忽略，防止死循环
            if (e.isTriggeredByScript) return;

            const target = e.target;
            const isInputArea = target.tagName === 'TEXTAREA' || target.isContentEditable || target.getAttribute('role') === 'textbox';

            // 如果事件不是发生在输入区，或者按下的不是 Enter 键，则不处理
            if (!isInputArea || e.key !== 'Enter') return;

            // --- 场景一：用户按下 Ctrl+Enter (发送消息) ---
            if (e.ctrlKey && !e.shiftKey && !e.altKey) {
                console.log(`[${SCRIPT_NAME}] 检测到 Ctrl+Enter，执行发送。`);
                e.preventDefault();
                e.stopImmediatePropagation(); // 阻止其他任何监听器处理此事件

                // 对特定网站进行适配
                if (hostname.includes('qwen.ai')) {
                    // 通义千问：通过点击按钮发送
                    console.log(`[${SCRIPT_NAME}] 适配[通义千问]：点击发送按钮。`);
                    const sendButton = document.querySelector('button[data-spm-anchor-id*="send"]'); // 使用更可靠的选择器
                    sendButton?.click();
                } else {
                    // 默认策略 (适用于 ChatGPT, Claude, Deepseek 等): 模拟一个纯粹的 Enter 按键事件来触发表单提交
                     console.log(`[${SCRIPT_NAME}] 适配[默认/ChatGPT/Claude]：模拟原生 Enter 发送。`);
                    target.dispatchEvent(createKeyEvent('keydown', {}));
                    target.dispatchEvent(createKeyEvent('keyup', {}));
                }
            }
            // --- 场景二：用户只按下 Enter (换行) ---
            else if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
                console.log(`[${SCRIPT_NAME}] 检测到 Enter，执行换行。`);
                e.preventDefault();
                e.stopImmediatePropagation();

                // 对特定网站进行适配
                if (hostname.includes('chatgpt.com') || hostname.includes('gemini.google.com')) {
                    // ChatGPT 和 Gemini: 模拟 Shift+Enter 是最可靠的换行方式
                    console.log(`[${SCRIPT_NAME}] 适配[ChatGPT/Gemini]：模拟 Shift+Enter 换行。`);
                    target.dispatchEvent(createKeyEvent('keydown', { shiftKey: true }));
                } else {
                    // 默认/后备策略 (适用于 Claude, Qwen 等): 使用 execCommand 插入换行符，兼容性好
                    console.log(`[${SCRIPT_NAME}] 适配[默认/Claude/Qwen]：使用 execCommand 换行。`);
                    document.execCommand('insertText', false, '\n');
                }
            }
            // --- 其他情况 (如 Shift+Enter) ---
            // 脚本不干预，允许其执行原生行为。

        }, true); // `true` 表示在捕获阶段执行

        console.log(`[${SCRIPT_NAME}] 智能适配事件监听器已成功设置。`);
    })();

})();
