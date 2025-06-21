// ==UserScript==
// @name         统一 AI 对话发送键 v2.1 (Ctrl+Enter-多站智能适配版)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  智能适配多个 AI 网站，统一使用 Ctrl+Enter 发送，单独 Enter 换行。为 Qwen 和 ChatGPT 提供专属优化策略。
// @author       Gemini (-Massively improved by user feedback)
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://chat.deepseek.com/*
// @match        https://chat.qwen.ai/*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @match        https://grok.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_NAME = '统一 AI 对话发送键 v2.1';
    const hostname = window.location.hostname;
    console.log(`[${SCRIPT_NAME}] 脚本已加载，当前网站: ${hostname}`);

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
