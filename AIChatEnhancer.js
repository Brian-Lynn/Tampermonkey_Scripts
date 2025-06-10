// ==UserScript==
// @name         多功能 AI 助手 (All-in-One AI Helper)
// @namespace    http://tampermonkey.net/
// @version      4.6
// @description  【终极修复版】1. 公式复制器保持稳定。2. 修复v4.5版本中因无限循环导致的页面崩溃问题，让换行与发送功能恢复正常。
// @author       You & Gemini
// @match        https://chatgpt.com/*
// @match        https://chat.deepseek.com/*
// @match        https://chat.qwen.ai/*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @match        https://grok.com/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-idle
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


    // --- 功能二：回车不发送 (v4.6 修复版) ---
    (function EnterNoSend() {
        console.log("回车不发送: 模块已启动 (v4.6 状态管理修复版)。");

        let ctrlKeyPressed = false;
        let isDispatching = false; // 关键：用于防止无限循环的“旗标”

        // 监听 Ctrl 键的按下和抬起
        document.body.addEventListener('keydown', (e) => {
            if (e.key === 'Control') {
                ctrlKeyPressed = true;
            }
        }, true);

        document.body.addEventListener('keyup', (e) => {
            if (e.key === 'Control') {
                ctrlKeyPressed = false;
            }
        }, true);

        // 核心逻辑监听器
        document.body.addEventListener('keydown', function(e) {
            // 如果是脚本自己派发的事件，则直接忽略
            if (isDispatching) {
                return;
            }

            const activeElement = document.activeElement;
            const isInputArea = activeElement && (
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.getAttribute('role') === 'textbox' ||
                activeElement.isContentEditable
            );

            if (!isInputArea) return;

            if (e.key === 'Enter') {
                if (ctrlKeyPressed || e.ctrlKey) {
                    e.preventDefault();
                    e.stopPropagation();

                    const enterEvent = new KeyboardEvent('keydown', {
                        key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                        bubbles: true, cancelable: true
                    });

                    isDispatching = true; // 在派发前升起“旗标”
                    activeElement.dispatchEvent(enterEvent);
                    isDispatching = false; // 派发后降下“旗标”
                }
                else if (!e.shiftKey && !e.altKey && !e.metaKey) {
                    e.preventDefault();
                    e.stopPropagation();

                     const shiftEnterEvent = new KeyboardEvent('keydown', {
                        key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                        shiftKey: true, // 模拟 Shift+Enter
                        bubbles: true, cancelable: true
                    });

                    isDispatching = true; // 在派发前升起“旗标”
                    activeElement.dispatchEvent(shiftEnterEvent);
                    isDispatching = false; // 派发后降下“旗标”
                }
            }
        }, true);
    })();

})();
