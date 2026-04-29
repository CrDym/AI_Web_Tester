import { useMemo, useState } from 'react';

type Props = {
  dataset: any[];
  onChange: (dataset: any[]) => void;
};

export default function DatasetEditor({ dataset, onChange }: Props) {
  const initial = useMemo(() => JSON.stringify(dataset || [], null, 2), []);
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const commit = (next: any[]) => {
    setError(null);
    onChange(next);
    setText(JSON.stringify(next, null, 2));
  };

  const handleBlur = () => {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setError('数据集必须是一个 JSON 数组（List）');
        return;
      }
      commit(parsed);
    } catch (e: any) {
      setError('无效的 JSON 格式: ' + e.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try {
        let parsed: any[] = [];
        if (file.name.endsWith('.csv')) {
          const lines = content.split('\n').filter(line => line.trim() !== '');
          if (lines.length < 2) {
            setError('CSV 格式无效或无数据');
            return;
          }
          const headers = lines[0].split(',').map(h => h.trim());
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const obj: any = {};
            headers.forEach((h, idx) => {
              obj[h] = values[idx] || '';
            });
            parsed.push(obj);
          }
        } else {
          parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            setError('上传的 JSON 必须是一个数组');
            return;
          }
        }
        commit(parsed);
      } catch (err: any) {
        setError('解析文件失败: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-bold tracking-widest text-[#f4f4f5] uppercase">绑定数据集 (JSON Array)</span>
          <span className="text-[11px] text-zinc-500 max-w-xl leading-relaxed">
            运行时会自动使用 <code className="text-[#00e5ff] px-1 bg-[#00e5ff]/10 rounded">{'${变量名}'}</code> 替换用例中的内容。如果数组为空或未配置，则仅运行一次。
          </span>
        </div>
        <label className="shrink-0 cursor-pointer bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30 px-4 py-2 rounded text-[11px] font-bold tracking-wider uppercase transition-all shadow-[0_0_10px_rgba(0,229,255,0.05)] hover:shadow-[0_0_15px_rgba(0,229,255,0.2)]">
          导入 JSON / CSV 文件
          <input type="file" accept=".json,.csv" className="hidden" onChange={handleFileChange} />
        </label>
      </div>
      {error && <div className="text-xs text-rose-500">{error}</div>}
      <textarea
        className="flex-1 w-full bg-[#0a0e17]/80 backdrop-blur-xl border border-[#00e5ff]/20 rounded-xl p-4 text-[13px] text-[#00e5ff] font-mono focus:outline-none focus:border-[#00e5ff]/50 focus:shadow-[0_0_20px_rgba(0,229,255,0.1)] transition-all custom-scrollbar leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        placeholder={`[\n  {\n    "username": "admin",\n    "password": "123"\n  },\n  {\n    "username": "guest",\n    "password": "456"\n  }\n]\n\n// 提示：如果你导入 CSV 文件，它会自动转化为上述的 JSON Array 格式。\n// 第一行（表头）会作为变量名（例如 username）。`}
      />
    </div>
  );
}

