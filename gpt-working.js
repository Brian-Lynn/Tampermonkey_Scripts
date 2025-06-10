// ==UserScript==
// @name         ENTER NO SEND
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Only Ctrl+Enter sends. Enter inserts newline. Fixed for latest ChatGPT UI.
// @author       You ＆ GPT 🐶✨
// @match        https://chatgpt.com/*
// @match        https://chat.deepseek.com/*
// @match        https://chat.qwen.ai/*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  window.addEventListener('keydown', function(e) {
    const active = document.activeElement;

    const isLikelyInput = (
      active &&
      (active.getAttribute('data-testid')?.includes('composer') ||
       active.className?.toString().includes('text') ||
       active.getAttribute('role') === 'textbox' ||
       active.isContentEditable)
    );

    if (
      isLikelyInput &&
      e.key === 'Enter' &&
      !e.ctrlKey &&
      !e.shiftKey
    ) {
      e.preventDefault();
      e.stopPropagation();

      if (active.isContentEditable) {
        // contentEditable 插入 <br> 换行并调整光标位置
        const br = document.createElement('br');
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(br);
        range.setStartAfter(br);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else if (typeof active.setRangeText === 'function') {
        // 普通 textarea/input 插入换行符
        active.setRangeText('\n', active.selectionStart, active.selectionEnd, 'end');
      } else {
        // 兜底方案：插入空格，避免无响应
        active.setRangeText(' ', active.selectionStart, active.selectionEnd, 'end');
      }
    }
  }, true);
})();