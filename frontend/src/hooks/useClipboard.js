/**
 * Copies text to the clipboard with transient "copied" feedback. Exposes copy()
 * (returns success) and copiedValue (auto-cleared after `timeout` ms).
 */
import { useEffect, useRef, useState } from 'react';
import logger from '../utils/logger';

export default function useClipboard({ timeout = 1200 } = {}) {
  const [copiedValue, setCopiedValue] = useState(null);
  const timeoutRef = useRef(null);

  // Clear the pending "copied" timer if the component unmounts, so we never call
  // setState on an unmounted component.
  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  // Falls back to a hidden <textarea> + execCommand where the async Clipboard
  // API is unavailable (e.g. non-secure contexts). Returns whether it succeeded.
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
