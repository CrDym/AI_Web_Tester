import { useRef, useState } from 'react';
import type { ConfirmModalOptions, PromptModalOptions } from '../types';

export function useModalDialogs() {
  const [confirmModal, setConfirmModal] = useState<ConfirmModalOptions | null>(null);
  const confirmResolverRef = useRef<((ok: boolean) => void) | null>(null);
  const [promptModal, setPromptModal] = useState<PromptModalOptions | null>(null);
  const promptResolverRef = useRef<((val: string | null) => void) | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const confirmAction = (opts: ConfirmModalOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmModal(opts);
    });
  };

  const closeConfirm = (ok: boolean) => {
    setConfirmModal(null);
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    if (resolver) resolver(ok);
  };

  const promptAction = (opts: PromptModalOptions) => {
    return new Promise<string | null>((resolve) => {
      promptResolverRef.current = resolve;
      setPromptValue(opts.initialValue || '');
      setPromptModal(opts);
    });
  };

  const closePrompt = (val: string | null) => {
    setPromptModal(null);
    const resolver = promptResolverRef.current;
    promptResolverRef.current = null;
    if (resolver) resolver(val);
  };

  return {
    confirmModal,
    confirmAction,
    closeConfirm,
    promptModal,
    promptAction,
    closePrompt,
    promptValue,
    setPromptValue,
  };
}
