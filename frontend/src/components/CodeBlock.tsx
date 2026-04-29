import { useEffect, useMemo, useState } from 'react';

type Props = {
  code: string;
  language?: string;
  className?: string;
};

export default function CodeBlock({ code, language = 'python', className }: Props) {
  const [Highlighter, setHighlighter] = useState<any>(null);
  const [style, setStyle] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import('react-syntax-highlighter'),
      import('react-syntax-highlighter/dist/esm/styles/prism'),
    ]).then(([h, s]) => {
      if (cancelled) return;
      const Prism = (h as any).Prism || (h as any).default;
      setHighlighter(() => Prism);
      setStyle((s as any).vscDarkPlus || (s as any).default);
    }).catch(() => {
      if (cancelled) return;
      setHighlighter(() => null);
      setStyle(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const safeCode = useMemo(() => code || '', [code]);

  if (!Highlighter || !style) {
    return (
      <pre className={className}>
        <code>{safeCode}</code>
      </pre>
    );
  }

  return (
    <Highlighter language={language} style={style} customStyle={{ margin: 0, background: 'transparent' }} className={className}>
      {safeCode}
    </Highlighter>
  );
}

