/**
 * Hook for copying text to the clipboard with transient "copied" feedback.
 *
 * Exposes:
 *   - copy(text): copies and returns a boolean success flag.
 *   - copiedValue: the most recently copied value, auto-cleared after `timeout`
 *     ms (used to drive a "copied!" indicator).
 *
 * @param {{ timeout?: number }} [opts] Milliseconds before clearing copiedValue.
 */
import { useRef, useState } from 'react';
import logger from '../utils/logger';

export default function useClipboard({ timeout = 1200 } = {}) {
  const [copiedValue, setCopiedValue] = useState(null);
  const timeoutRef = useRef(null);

  /**
   * Copies text to the clipboard, falling back to a hidden <textarea> +
   * execCommand for browsers/contexts without the async Clipboard API.
   * @param {string} text Text to copy.
   * @returns {Promise<boolean>} Whether the copy succeeded.
   */
  const copy = async (text) => {
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        success = true;
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch (err) {
      logger.error('clipboard.copy.error', err);
      success = false;
    }

    if (success) {
      setCopiedValue(text);
      // Reset any pending clear timer so rapid successive copies extend feedback.
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setCopiedValue(null);
      }, timeout);
    }

    return success;
  };

  return { copy, copiedValue };
}
