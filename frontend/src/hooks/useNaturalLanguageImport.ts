import { useState } from 'react';
import type { NaturalLanguageImportItem } from '../types';

export function useNaturalLanguageImport() {
  const [importNlText, setImportNlText] = useState('');
  const [importNlGroup, setImportNlGroup] = useState('导入用例');
  const [importNlStartUrl, setImportNlStartUrl] = useState('');
  const [importNlItems, setImportNlItems] = useState<NaturalLanguageImportItem[]>([]);
  const [importNlSelected, setImportNlSelected] = useState<number[]>([]);
  const [importNlLoading, setImportNlLoading] = useState(false);
  const [importNlError, setImportNlError] = useState('');

  const clearImportNlPreview = () => {
    setImportNlItems([]);
    setImportNlSelected([]);
    setImportNlError('');
  };

  const resetImportNl = () => {
    setImportNlText('');
    setImportNlItems([]);
    setImportNlSelected([]);
    setImportNlError('');
  };

  const setImportNlTextAndClearPreview = (text: string) => {
    setImportNlText(text);
    clearImportNlPreview();
  };

  return {
    importNlText,
    setImportNlText,
    importNlGroup,
    setImportNlGroup,
    importNlStartUrl,
    setImportNlStartUrl,
    importNlItems,
    setImportNlItems,
    importNlSelected,
    setImportNlSelected,
    importNlLoading,
    setImportNlLoading,
    importNlError,
    setImportNlError,
    clearImportNlPreview,
    resetImportNl,
    setImportNlTextAndClearPreview,
  };
}
