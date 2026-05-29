import { Plus, RotateCw, SquareTerminal, XCircle } from 'lucide-react';
import type { EnvConfig } from '../types';

interface CreateSuiteModalProps {
  name: string;
  envId: string;
  envs: EnvConfig[];
  creating: boolean;
  onNameChange: (value: string) => void;
  onEnvIdChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function CreateSuiteModal({
  name,
  envId,
  envs,
  creating,
  onNameChange,
  onEnvIdChange,
  onClose,
  onConfirm,
}: CreateSuiteModalProps) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.16)] w-full max-w-xl p-8 flex flex-col relative overflow-hidden">
        <div className="flex items-start justify-between mb-6 relative z-10">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
              <SquareTerminal className="w-5 h-5 text-[#10a37f]" />
              新建测试套件
            </h2>
            <div className="text-sm text-zinc-600 mt-1">将多个用例组合成一次回归计划（顺序执行，失败继续跑）。</div>
          </div>
          <button
            onClick={() => { if (!creating) onClose(); }}
            disabled={creating}
            className="text-zinc-500 hover:text-zinc-900 transition-colors hover:bg-zinc-100 p-2 rounded-full disabled:opacity-50"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider">套件名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(); }}
              className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-3 text-base text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
              placeholder="例如：Smoke 回归 / 登录链路"
              disabled={creating}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider">运行环境（统一）</label>
            <select
              value={envId}
              onChange={(e) => onEnvIdChange(e.target.value)}
              disabled={creating}
              className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-3 text-base text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all"
            >
              <option value="">默认环境</option>
              {envs.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 relative z-10">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={creating || !name.trim()}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[#10a37f] hover:bg-[#0e8a6a] flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {creating ? <RotateCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            创建套件
          </button>
        </div>
      </div>
    </div>
  );
}
