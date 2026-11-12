type Props = {
  code: string;
  language?: string;
  className?: string;
};

// 轻量 Python 语法高亮：tokenizer + span 着色，零依赖
// 顺序敏感：多行注释/字符串 → 注释 → 关键字/内建 → 装饰器 → f-string 占位 → 函数调用 → 数字/常量
type Token = { text: string; cls: string };

const PY_KEYWORDS = new Set([
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or',
  'import', 'from', 'as', 'with', 'try', 'except', 'finally', 'raise', 'assert',
  'class', 'pass', 'break', 'continue', 'lambda', 'global', 'nonlocal', 'del',
  'yield', 'async', 'await',
]);
const PY_CONSTANTS = new Set(['True', 'False', 'None']);
const PY_BUILTINS = new Set([
  'print', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'len',
  'range', 'enumerate', 'zip', 'open', 'isinstance', 'type', 'format', 'json',
  'os', 'sys', 're', 'datetime', 'Exception', 'ValueError', 'TypeError',
]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tokenizeLine(line: string, inTriple: boolean): { tokens: Token[]; triple: boolean } {
  const tokens: Token[] = [];
  let i = 0;
  let tripleHere = false;
  const push = (text: string, cls: string) => { if (text) tokens.push({ text: escapeHtml(text), cls }); };

  if (inTriple) {
    const end = line.indexOf("'''") >= 0 ? line.indexOf("'''") : line.indexOf('"""');
    if (end >= 0) {
      const closeLen = line.indexOf("'''") >= 0 ? 3 : 3;
      push(line.slice(0, end + 3), 'text-emerald-600 dark:text-emerald-400');
      i = end + closeLen;
    } else {
      push(line, 'text-emerald-600 dark:text-emerald-400');
      return { tokens, triple: true };
    }
  }

  while (i < line.length) {
    const rest = line.slice(i);

    // 多行注释开始
    if (rest.startsWith("'''") || rest.startsWith('"""')) {
      const open = rest.slice(0, 3);
      const closeIdx = rest.indexOf(open, 3);
      if (closeIdx >= 0) {
        push(rest.slice(0, closeIdx + 3), 'text-emerald-600 dark:text-emerald-400');
        i += closeIdx + 3;
      } else {
        push(rest, 'text-emerald-600 dark:text-emerald-400');
        tripleHere = true;
        break;
      }
      continue;
    }

    // 行注释
    const hashIdx = indexOfUnquoted(rest, '#');
    if (hashIdx === 0) {
      push(rest, 'text-zinc-400 dark:text-zinc-500 italic');
      break;
    }

    // 字符串（含前缀 f/r/f"
    const strMatch = rest.match(/^(?:[fFrRbB]{0,2})('''|"""|'|")(?:\\.|[^\\])*?\1/);
    if (strMatch && strMatch[0]) {
      push(strMatch[0], 'text-emerald-600 dark:text-emerald-400');
      i += strMatch[0].length;
      continue;
    }

    // 装饰器
    const decoMatch = rest.match(/^@[\w.]+/);
    if (decoMatch) {
      push(decoMatch[0], 'text-violet-600 dark:text-violet-400');
      i += decoMatch[0].length;
      continue;
    }

    // f-string 占位 {expr}
    if (line[i] === '{' || line[i] === '}') {
      push(line[i], 'text-cyan-600 dark:text-cyan-400 font-medium');
      i += 1;
      continue;
    }

    // 标识符（关键字/内建/函数调用）
    const idMatch = rest.match(/^[A-Za-z_]\w*/);
    if (idMatch) {
      const word = idMatch[0];
      const after = rest.slice(word.length);
      if (PY_KEYWORDS.has(word)) {
        push(word, 'text-violet-600 dark:text-violet-400 font-medium');
      } else if (PY_CONSTANTS.has(word)) {
        push(word, 'text-amber-600 dark:text-amber-400');
      } else if (PY_BUILTINS.has(word) || /^\s*\(/.test(after)) {
        push(word, 'text-sky-600 dark:text-sky-400');
      } else {
        push(word, '');
      }
      i += word.length;
      continue;
    }

    // 数字
    const numMatch = rest.match(/^\d[\d_]*(?:\.\d+)?/);
    if (numMatch) {
      push(numMatch[0], 'text-amber-600 dark:text-amber-400');
      i += numMatch[0].length;
      continue;
    }

    // 操作符与标点
    const opMatch = rest.match(/^[+\-*/%=<>!&|^~:;,.(){}\[\]]+/);
    if (opMatch) {
      push(opMatch[0], 'text-zinc-500 dark:text-zinc-400');
      i += opMatch[0].length;
      continue;
    }

    // 空白与其他
    const wsMatch = rest.match(/^\s+/);
    if (wsMatch) {
      push(wsMatch[0], '');
      i += wsMatch[0].length;
    } else {
      push(line[i], '');
      i += 1;
    }
  }
  return { tokens, triple: tripleHere };
}

/** 找到不在引号内的 '#'；找不到返回 -1 */
function indexOfUnquoted(s: string, ch: string): number {
  let inStr: string | null = null;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (inStr) {
      if (c === '\\') { k++; continue; }
      if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'") {
      inStr = c;
    } else if (c === ch) {
      return k;
    }
  }
  return -1;
}

export default function CodeBlock({ code, language = 'python', className }: Props) {
  const source = code || '';
  const python = language === 'python';
  let body: string;

  if (python) {
    const out: string[] = [];
    let inTriple = false;
    for (const line of source.split('\n')) {
      const { tokens, triple } = tokenizeLine(line, inTriple);
      inTriple = triple;
      out.push(
        `<span class="block">${tokens.map((t) => (t.cls ? `<span class="${t.cls}">${t.text}</span>` : t.text)).join('')}</span>`
      );
    }
    body = out.join('\n');
  } else {
    body = escapeHtml(source);
  }

  return (
    <pre
      className={`${className || ''} whitespace-pre overflow-auto rounded-none bg-transparent`}
      data-language={language}
    >
      <code
        dangerouslySetInnerHTML={{ __html: body }}
        className={python
          ? 'text-zinc-800 dark:text-zinc-200'
          : 'text-zinc-800 dark:text-zinc-200'}
      />
    </pre>
  );
}
