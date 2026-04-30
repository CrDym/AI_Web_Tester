import { useEffect, useMemo, useState } from 'react';

type Props = {
  code: string;
  language?: string;
  className?: string;
};

export default function CodeBlock({ code, language = 'python', className }: Props) {
  const [Highlighter, setHighlighter] = useState<any>(null);
  const [styles, setStyles] = useState<{ light: any; dark: any } | null>(null);
  const [isDark, setIsDark] = useState(() => {
    try {
      return document.documentElement.classList.contains('dark');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import('react-syntax-highlighter'),
      import('react-syntax-highlighter/dist/esm/styles/prism'),
    ]).then(([h, s]) => {
      if (cancelled) return;
      const Prism = (h as any).Prism || (h as any).default;
      setHighlighter(() => Prism);
      const light = (s as any).oneLight || (s as any).vs || (s as any).default;
      const dark = (s as any).vscDarkPlus || (s as any).oneDark || (s as any).okaidia || (s as any).default;
      setStyles({ light, dark });
    }).catch(() => {
      if (cancelled) return;
      setHighlighter(() => null);
      setStyles(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const el = document.documentElement;
      const obs = new MutationObserver(() => {
        setIsDark(el.classList.contains('dark'));
      });
      obs.observe(el, { attributes: true, attributeFilter: ['class'] });
      return () => obs.disconnect();
    } catch {
      return;
    }
  }, []);

  const safeCode = useMemo(() => code || '', [code]);

  const style = styles ? (isDark ? styles.dark : styles.light) : null;

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
