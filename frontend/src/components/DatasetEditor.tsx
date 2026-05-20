import { type ChangeEvent, useState } from 'react';

type JsonObject = Record<string, unknown>;
type DatasetRow = Record<string, unknown>;

type Props = {
  variables: JsonObject;
  dataset: DatasetRow[];
  onVariablesChange: (variables: JsonObject) => void;
  onDatasetChange: (dataset: DatasetRow[]) => void;
};

const getErrorMessage = (err: unknown) => err instanceof Error ? err.message : String(err);

export default function DatasetEditor({ variables, dataset, onVariablesChange, onDatasetChange }: Props) {
  const [variablesText, setVariablesText] = useState(() => JSON.stringify(variables || {}, null, 2));
  const [datasetText, setDatasetText] = useState(() => JSON.stringify(dataset || [], null, 2));
  const [variablesError, setVariablesError] = useState<string | null>(null);
  const [datasetError, setDatasetError] = useState<string | null>(null);

  const commitVariables = (next: JsonObject) => {
    setVariablesError(null);
    onVariablesChange(next);
    setVariablesText(JSON.stringify(next, null, 2));
  };

  const commitDataset = (next: DatasetRow[]) => {
    setDatasetError(null);
    onDatasetChange(next);
    setDatasetText(JSON.stringify(next, null, 2));
  };

  const handleVariablesBlur = () => {
    try {
      const parsed = JSON.parse(variablesText || '{}') as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setVariablesError('用例变量必须是一个 JSON 对象');
        return;
      }
      commitVariables(parsed as JsonObject);
    } catch (err: unknown) {
      setVariablesError('无效的 JSON 格式: ' + getErrorMessage(err));
    }
  };

  const handleDatasetBlur = () => {
    try {
      const parsed = JSON.parse(datasetText || '[]') as unknown;
      if (!Array.isArray(parsed)) {
        setDatasetError('数据集必须是一个 JSON 数组');
        return;
      }
      commitDataset(parsed as DatasetRow[]);
    } catch (err: unknown) {
      setDatasetError('无效的 JSON 格式: ' + getErrorMessage(err));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try {
        let parsed: DatasetRow[] = [];
        if (file.name.endsWith('.csv')) {
          const lines = content.split('\n').filter(line => line.trim() !== '');
          if (lines.length < 2) {
            setDatasetError('CSV 格式无效或无数据');
            return;
          }
          const headers = lines[0].split(',').map(h => h.trim());
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const obj: DatasetRow = {};
            headers.forEach((h, idx) => {
              obj[h] = values[idx] || '';
            });
            parsed.push(obj);
          }
        } else {
          const fileJson = JSON.parse(content) as unknown;
          if (!Array.isArray(fileJson)) {
            setDatasetError('上传的 JSON 必须是一个数组');
            return;
          }
          parsed = fileJson as DatasetRow[];
        }
        commitDataset(parsed);
      } catch (err: unknown) {
        setDatasetError('解析文件失败: ' + getErrorMessage(err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="h-full min-h-0 flex flex-col p-4">
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 min-h-0 flex-1">
        <div className="flex flex-col min-h-[320px] 2xl:min-h-0 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">用例变量</div>
                <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  默认变量，适合单次运行。可在 <code className="text-[#0e8a6a] dark:text-[#10a37f] px-1 bg-[#10a37f]/10 rounded">{'${变量名}'}</code> 中引用。
                </div>
              </div>
              <div className="shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                object
              </div>
            </div>
            <div className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
              内置 <code className="text-[#0e8a6a] dark:text-[#10a37f] px-1 bg-[#10a37f]/10 rounded">{'${today_ymd}'}</code> 会生成当天验证码格式，例如 260507。
            </div>
          </div>
          {variablesError && <div className="mx-4 mt-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{variablesError}</div>}
          <textarea
            className="flex-1 min-h-[220px] w-full resize-none bg-white dark:bg-zinc-950 p-4 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono focus:outline-none transition-all custom-scrollbar leading-relaxed"
            value={variablesText}
            onChange={(e) => setVariablesText(e.target.value)}
            onBlur={handleVariablesBlur}
            placeholder={`{\n  "username": "admin",\n  "password": "123456",\n  "base_url": "https://qa.example.com"\n}`}
          />
        </div>

        <div className="flex flex-col min-h-[320px] 2xl:min-h-0 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">数据集</div>
                <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  多行数据会循环运行；每行会覆盖同名用例变量。
                </div>
              </div>
              <label className="shrink-0 cursor-pointer bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all shadow-sm">
                导入文件
                <input type="file" accept=".json,.csv" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
              <span>数组为空时仅使用左侧变量运行一次。</span>
              <span className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-0.5 font-mono">JSON / CSV</span>
            </div>
          </div>
          {datasetError && <div className="mx-4 mt-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{datasetError}</div>}
          <textarea
            className="flex-1 min-h-[220px] w-full resize-none bg-white dark:bg-zinc-950 p-4 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono focus:outline-none transition-all custom-scrollbar leading-relaxed"
            value={datasetText}
            onChange={(e) => setDatasetText(e.target.value)}
            onBlur={handleDatasetBlur}
            placeholder={`[\n  {\n    "username": "admin",\n    "password": "123"\n  },\n  {\n    "username": "guest",\n    "password": "456"\n  }\n]`}
          />
        </div>
      </div>
    </div>
  );
}
