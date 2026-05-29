type Props = {
  code: string;
  language?: string;
  className?: string;
};

export default function CodeBlock({ code, language = 'python', className }: Props) {
  return (
    <pre
      className={`${className || ''} whitespace-pre overflow-auto rounded-none bg-transparent text-zinc-800 dark:text-zinc-200`}
      data-language={language}
    >
      <code>{code || ''}</code>
    </pre>
  );
}
