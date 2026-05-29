import { useState } from 'react';

export interface GenerateCaseForm {
  name: string;
  start_url: string;
  instruction: string;
}

const EMPTY_FORM: GenerateCaseForm = { name: '', start_url: '', instruction: '' };

export function useGenerateCaseForm() {
  const [generateForm, setGenerateForm] = useState<GenerateCaseForm>(EMPTY_FORM);
  const [generating, setGenerating] = useState(false);

  const resetGenerateForm = () => setGenerateForm(EMPTY_FORM);

  return {
    generateForm,
    setGenerateForm,
    generating,
    setGenerating,
    resetGenerateForm,
  };
}
