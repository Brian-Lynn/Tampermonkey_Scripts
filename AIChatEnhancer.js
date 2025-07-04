// ==UserScript==
// @name         AI平台_Web体验优化 (强力拦截版 v6.5)
// @namespace    http://tampermonkey.net/
// @version      6.5
// @description  【强力拦截版】1. 彻底阻止Enter键直接发送，改为Ctrl+Enter发送。为Qwen增加ID选择器，优先点击按钮发送。2. 支持点击复制数学公式的LaTeX代码。
// @author       0xbbbb & Gemini & GPT (重构 by Gemini)
// @match        https://chatgpt.com/*
// @match        https://chat.deepseek.com/*
// @match        https://chat.qwen.ai/*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @match        https://grok.com/*
// @match        https://copilot.microsoft.com/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-start
// @downloadURL  https://update.greasyfork.org/scripts/539014/AI%E5%B9%B3%E5%8F%B0_Web%E4%BD%93%E9%AA%8C%E4%BC%98%E5%8C%96%20v65.user.js
// @updateURL    https://update.greasyfork.org/scripts/539014/AI%E5%B9%B3%E5%8F%B0_Web%E4%BD%93%E9%AA%8C%E4%BC%98%E5%8C%96%20v65.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_NAME = 'AIChatEnhancer-v6.5';
    const currentHostname = window.location.hostname;

    // --- 模块一：公式复制器 ---
    if (!currentHostname.includes('gemini.google.com') && !currentHostname.includes('claude.ai')) {
        (function FormulaCopier() {
             function initFormulaCopier() {
                if (!document.body) { setTimeout(initFormulaCopier, 100); return; }
                console.log(`[${SCRIPT_NAME}] DOM ready, 启动【公式复制器】。`);
                GM_addStyle(`
                    .formula-copier-selected { outline: 2px solid #4A90E2 !important; border-radius: 5px; cursor: pointer; box-shadow: 0 0 5px rgba(74, 144, 226, 0.5); }
                    .formula-copier-feedback { position: fixed; background-color: #4A90E2; color: white; padding: 5px 10px; border-radius: 5px; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index: 10001; pointer-events: none; opacity: 0; transition: opacity 0.3s ease, transform 0.3s ease; transform: translateY(10px); }
                    .formula-copier-feedback.visible { opacity: 1; transform: translateY(0); }
                `);
                let selectedElement = null;
                function showCopyFeedback(element) {
                    const rect = element.getBoundingClientRect();
                    const feedback = document.createElement('div');
                    feedback.textContent = 'LaTeX 已复制!';
                    feedback.classList.add('formula-copier-feedback');
                    document.body.appendChild(feedback);
                    feedback.style.left = `${rect.left + rect.width / 2 - feedback.offsetWidth / 2}px`;
                    feedback.style.top = `${rect.top - feedback.offsetHeight - 8}px`;
                    setTimeout(() => { feedback.classList.add('visible'); }, 10);
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
                    return annotation ? annotation.textContent.trim().replace(/\s*\\tag\{.*\}/, '').trim() : null;
                }
                function handleFormulaClick(event) {
                    event.stopPropagation();
                    const target = event.currentTarget;
                    if (target === selectedElement) {
                        const latex = getLatexSource(target);
                        if (latex) {
                            GM_setClipboard(latex);
                            showCopyFeedback(target);
                        }
                        clearSelection();
                    } else {
                        clearSelection();
                        selectedElement = target;
                        selectedElement.classList.add('formula-copier-selected');
                    }
                }
                function findAndBind(rootNode) {
                    if (!rootNode || rootNode.nodeType !== Node.ELEMENT_NODE) return;
                    const formulas = rootNode.querySelectorAll('.katex, .katex-display, .mjx-container');
                    formulas.forEach(formula => {
                        if (formula.dataset.formulaCopierAttached || formula.closest('[data-formula-copier-attached="true"]')) return;
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
            }
            if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initFormulaCopier); } else { initFormulaCopier(); }
        })();
    }


    // --- 模块二：回车/Ctrl+Enter 增强 (强力拦截版 v6.5) ---
    (function EnterNoSendEnhanced() {
        console.log(`[${SCRIPT_NAME}] 模块【回车增强-强力拦截版】: 准备加载。`);

        function createKeyEvent(type, options) {
            const event = new KeyboardEvent(type, {
                key: options.key || 'Enter', code: options.code || 'Enter', keyCode: options.keyCode || 13, which: options.which || 13,
                shiftKey: !!options.shiftKey, ctrlKey: !!options.ctrlKey, altKey: !!options.altKey, metaKey: !!options.metaKey,
                bubbles: true, cancelable: true
            });
            Object.defineProperty(event, 'isTriggeredByScript', { value: true, writable: false });
            return event;
        }

        function simulateAdvancedEnter(target) {
            console.log(`[${SCRIPT_NAME}] 启动高级Enter模拟发送...`);
            target.focus();
            const beforeInput = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertLineBreak', data: null });
            target.dispatchEvent(beforeInput);
            if (!beforeInput.defaultPrevented) {
                console.log(`[${SCRIPT_NAME}] 'beforeinput' 未被阻止，继续完整模拟流程。`);
                target.dispatchEvent(createKeyEvent('keydown', {}));
                const inputEvent = new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertLineBreak' });
                target.dispatchEvent(inputEvent);
                target.dispatchEvent(createKeyEvent('keyup', {}));
            } else {
                 console.log(`[${SCRIPT_NAME}] 'beforeinput' 已被框架处理，模拟完成。`);
            }
        }

        function handleKeyDown(e) {
            if (e.isTriggeredByScript) return;
            if (e.key !== 'Enter' || e.altKey || e.metaKey || e.shiftKey) return;

            if (e.ctrlKey) {
                console.log(`[${SCRIPT_NAME}] 检测到 Ctrl+Enter，执行发送。`);
                e.preventDefault(); e.stopImmediatePropagation();

                let sendButton;

                // 核心修复：针对Qwen，优先使用ID选择器点击按钮
                if (currentHostname.includes('qwen.ai')) {
                    sendButton = document.querySelector('#send-message-button');
                    if (sendButton && !sendButton.disabled) {
                        console.log(`[${SCRIPT_NAME}] 适配[Qwen]：通过ID找到发送按钮并执行 click()。`, sendButton);
                        sendButton.click();
                        return; // 成功发送，任务结束
                    }
                    // 如果找不到按钮，才使用备用的高级模拟方案
                    console.warn(`[${SCRIPT_NAME}] 适配[Qwen]：ID选择器未找到按钮，回退到高级事件模拟。`);
                    simulateAdvancedEnter(e.target);
                    return;
                }

                // 其他网站的逻辑保持不变
                if (currentHostname.includes('chatgpt.com')) {
                    sendButton = document.querySelector('button[data-testid="send-button"]');
                } else if (currentHostname.includes('claude.ai')) {
                    sendButton = document.querySelector('button[aria-label="Send Message"]') || document.querySelector('button[aria-label="发送消息"]');
                } else if (currentHostname.includes('deepseek.com')) {
                    sendButton = document.querySelector('button.ds-it-btn-send');
                }

                if (sendButton && !sendButton.disabled) {
                    console.log(`[${SCRIPT_NAME}] 适配[${currentHostname}]：找到发送按钮并执行 click()。`, sendButton);
                    sendButton.click();
                } else {
                    console.warn(`[${SCRIPT_NAME}] 适配[${currentHostname}]：未找到发送按钮，回退到模拟原生Enter发送。`);
                    e.target.dispatchEvent(createKeyEvent('keydown', {}));
                }
            } else {
                console.log(`[${SCRIPT_NAME}] 检测到单独的 Enter，执行换行。`);
                e.preventDefault(); e.stopImmediatePropagation();
                e.target.dispatchEvent(createKeyEvent('keydown', { key: 'Enter', shiftKey: true }));
            }
        }

        function blockEnterPropagation(e) {
            if (e.isTriggeredByScript) return;
            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
                e.preventDefault(); e.stopImmediatePropagation();
            }
        }

        function attachInterceptor(element) {
            if (element.dataset.enterInterceptorAttached) return;
            if (element.offsetParent === null) return;
            console.log(`[${SCRIPT_NAME}] 发现可见输入框，正在附加强力拦截器...`, element);
            element.addEventListener('keydown', handleKeyDown, true);
            element.addEventListener('keypress', blockEnterPropagation, true);
            element.addEventListener('keyup', blockEnterPropagation, true);
            element.dataset.enterInterceptorAttached = 'true';
        }

        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const targets = [];
                            if (node.matches('textarea, div[contenteditable="true"]')) {
                                targets.push(node);
                            }
                            targets.push(...node.querySelectorAll('textarea, div[contenteditable="true"]'));
                            targets.forEach(attachInterceptor);
                        }
                    });
                }
            }
        });

        function initEnterInterceptor() {
            if (!document.body) { setTimeout(initEnterInterceptor, 100); return; }
            console.log(`[${SCRIPT_NAME}] DOM ready, 启动【回车增强-强力拦截版】。`);
            document.querySelectorAll('textarea, div[contenteditable="true"]').forEach(attachInterceptor);
            observer.observe(document.body, { childList: true, subtree: true });
            console.log(`[${SCRIPT_NAME}] 强力拦截模块已启动，正在监视输入框...`);
        }

        if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initEnterInterceptor); } else { initEnterInterceptor(); }
    })();

})();
