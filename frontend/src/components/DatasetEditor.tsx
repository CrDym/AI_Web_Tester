import { useState } from 'react';

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <div className="space-y-4 h-full flex flex-col">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0 flex-1">
        <div className="flex flex-col min-h-0 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-col gap-1 mb-3">
            <span className="text-[13px] font-semibold tracking-wide text-zinc-900">用例变量</span>
            <span className="text-[11px] text-zinc-500 leading-relaxed">
              默认变量，适合单次运行。可在 <code className="text-[#0e8a6a] px-1 bg-[#10a37f]/10 rounded">{'${变量名}'}</code> 中引用。内置 <code className="text-[#0e8a6a] px-1 bg-[#10a37f]/10 rounded">{'${today_ymd}'}</code> 会生成当天验证码格式，例如 260507。
            </span>
          </div>
          {variablesError && <div className="text-xs text-rose-500 mb-2">{variablesError}</div>}
          <textarea
            className="flex-1 min-h-[180px] w-full bg-white border border-zinc-200 rounded-xl p-4 text-[13px] text-zinc-900 font-mono focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all custom-scrollbar leading-relaxed"
            value={variablesText}
            onChange={(e) => setVariablesText(e.target.value)}
            onBlur={handleVariablesBlur}
            placeholder={`{\n  "username": "admin",\n  "password": "123456",\n  "base_url": "https://qa.example.com"\n}`}
          />
        </div>

        <div className="flex flex-col min-h-0 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold tracking-wide text-zinc-900">数据集</span>
              <span className="text-[11px] text-zinc-500 leading-relaxed">
                多行数据会循环运行；每行会覆盖同名用例变量。数组为空时仅使用左侧用例变量运行一次。
              </span>
            </div>
            <label className="shrink-0 cursor-pointer bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 px-4 py-2 rounded-xl text-[11px] font-semibold transition-all">
              导入 JSON / CSV 文件
              <input type="file" accept=".json,.csv" className="hidden" onChange={handleFileChange} />
            </label>
          </div>
          {datasetError && <div className="text-xs text-rose-500 mb-2">{datasetError}</div>}
          <textarea
            className="flex-1 min-h-[180px] w-full bg-white border border-zinc-200 rounded-xl p-4 text-[13px] text-zinc-900 font-mono focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all custom-scrollbar leading-relaxed"
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
