// ==UserScript==
// @name         多功能 AI 助手 (All-in-One AI Helper) v5.1
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  【Claude修复版】1. 修复Claude回车发送问题。2. 公式复制器保持稳定。3. 修复v4.5版本中因无限循环导致的页面崩溃问题。
// @author       You & Gemini
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

    // --- 功能一：公式复制器 (在非 Gemini 和 Claude 的网站上运行) ---
    if (!currentHostname.includes('gemini.google.com') && !currentHostname.includes('claude.ai')) {
        (function FormulaCopier() {
            // 这个模块的代码已经很稳定，保持不变
            console.log("公式复制器: 模块已启动。");
            GM_addStyle(`
                .formula-copier-selected {
                    outline: 2px solid #4A90E2 !important; border-radius: 5px;
                    cursor: pointer; box-shadow: 0 0 5px rgba(74, 144, 226, 0.5);
                }
                .formula-copier-feedback {
                    position: absolute; background-color: #4A90E2; color: white;
                    padding: 4px 8px; border-radius: 4px; font-size: 12px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    z-index: 10001; pointer-events: none; opacity: 0;
                    transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
                    transform: translateY(10px);
                }
                .formula-copier-feedback.visible { opacity: 1; transform: translateY(0); }
            `);
            let selectedElement = null;
            function showCopyFeedback(element) {
                const rect = element.getBoundingClientRect();
                const feedback = document.createElement('div');
                feedback.textContent = '已复制!';
                feedback.classList.add('formula-copier-feedback');
                document.body.appendChild(feedback);
                const fbLeft = window.scrollX + rect.left + rect.width / 2 - feedback.offsetWidth / 2;
                const fbTop = window.scrollY + rect.top - feedback.offsetHeight - 8;
                feedback.style.left = `${fbLeft}px`;
                feedback.style.top = `${fbTop}px`;
                setTimeout(() => { feedback.style.opacity = '1'; feedback.style.transform = 'translateY(0)'; }, 10);
                setTimeout(() => {
                    feedback.style.opacity = '0';
                    feedback.style.transform = 'translateY(10px)';
                    setTimeout(() => feedback.remove(), 300);
                }, 1500);
            }
            function clearSelection() {
                if (selectedElement) {
                    selectedElement.classList.remove('formula-copier-selected');
                    selectedElement = null;
                }
            }
            function getLatexSource(containerElement) {
                const annotation = containerElement.querySelector('annotation[encoding="application/x-tex"], annotation[encoding="text/x-latex"]');
                if (annotation && annotation.textContent) {
                    return annotation.textContent.trim().replace(/\s*\\tag\{.*\}/, '').trim();
                }
                return null;
            }
            function handleFormulaClick(event) {
                event.stopPropagation();
                const target = event.currentTarget;
                if (target === selectedElement) {
                    const latex = getLatexSource(target);
                    if (latex) { GM_setClipboard(latex); showCopyFeedback(target); }
                    clearSelection();
                } else {
                    clearSelection();
                    selectedElement = target;
                    selectedElement.classList.add('formula-copier-selected');
                }
            }
            function findAndBind(rootNode) {
                if (rootNode.nodeType !== Node.ELEMENT_NODE) return;
                const formulas = rootNode.querySelectorAll('.katex, .katex-display, .mjx-container');
                formulas.forEach(formula => {
                    if (formula.dataset.formulaCopierAttached) return;
                    if (formula.closest('[data-formula-copier-attached="true"]')) return;
                    formula.dataset.formulaCopierAttached = 'true';
                    formula.addEventListener('click', handleFormulaClick);
                });
            }
            const observer = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach(node => findAndBind(node));
                    }
                }
            });
            findAndBind(document.body);
            observer.observe(document.body, { childList: true, subtree: true });
            document.addEventListener('click', (event) => {
                if (selectedElement && !selectedElement.contains(event.target)) {
                    clearSelection();
                }
            }, true);
        })();
    }


    // --- 功能二：回车不发送/统一发送键（2.1逻辑移植，兼容多站） ---
    (function EnterNoSendUnified() {
        console.log("回车不发送/统一发送键: 采用2.1.js核心逻辑，已启动。");

        const SCRIPT_NAME = 'AIChatEnhancer-EnterNoSend';
        const hostname = window.location.hostname;

        /**
         * 辅助函数：创建一个可配置的键盘事件。
         * @param {string} type - 事件类型, 'keydown' 或 'keyup'.
         * @param {object} options - 按键事件的配置.
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
            // 添加一个标志，防止我们自己的监听器响应自己创建的事件
            Object.defineProperty(event, 'isTriggeredByScript', { value: true, writable: false });
            return event;
        }

        // 在捕获阶段添加事件监听器，确保最高优先级
        document.addEventListener('keydown', (e) => {
            if (e.isTriggeredByScript) return; // 忽略自己派发的事件

            const target = e.target;
            const isInputArea = target.tagName === 'TEXTAREA' || target.isContentEditable || target.getAttribute('role') === 'textbox';

            if (!isInputArea || e.key !== 'Enter') return;

            // --- 场景一：使用 Ctrl+Enter 发送消息 ---
            if (e.ctrlKey && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                e.stopImmediatePropagation();

                // 根据不同网站执行不同策略
                if (hostname.includes('qwen.ai')) {
                    console.log(`[${SCRIPT_NAME}] Qwen 策略: 点击发送按钮。`);
                    const sendButton = document.getElementById('send-message-button');
                    sendButton?.click();
                } else {
                    // 默认策略（包括 ChatGPT），模拟一次干净的 Enter 按键
                    console.log(`[${SCRIPT_NAME}] 默认/GPT 策略: 模拟 Enter 按键发送。`);
                    target.dispatchEvent(createKeyEvent('keydown', {}));
                    target.dispatchEvent(createKeyEvent('keyup', {}));
                }
            }
            // --- 场景二：使用单独的 Enter 换行 ---
            else if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                e.stopImmediatePropagation();

                // 根据不同网站执行不同策略
                if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
                    // ChatGPT 策略: 模拟 Shift+Enter 来换行
                    console.log(`[${SCRIPT_NAME}] GPT 策略: 模拟 Shift+Enter 换行。`);
                    target.dispatchEvent(createKeyEvent('keydown', { shiftKey: true }));
                } else {
                    // 默认策略（包括 Qwen）：使用 execCommand 插入换行符
                    console.log(`[${SCRIPT_NAME}] 默认/Qwen 策略: 命令换行。`);
                    document.execCommand('insertText', false, '\n');
                }
            }
            // 对于其他组合键（如原生 Shift+Enter），脚本不干预

        }, true);

        console.log(`[${SCRIPT_NAME}] 智能适配事件监听器已成功设置。`);
    })();

})();
