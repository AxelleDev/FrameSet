// Utilitaire pour copier du texte dans le presse-papiers.
import { useRef, useState } from 'react';
import logger from '../utils/logger';

export default function useClipboard({ timeout = 1200 } = {}) {
  const [copiedValue, setCopiedValue] = useState(null);
  const timeoutRef = useRef(null);

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
