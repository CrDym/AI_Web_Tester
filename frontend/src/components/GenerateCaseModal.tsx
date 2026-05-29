import { RotateCw, SquareTerminal, Terminal, XCircle } from 'lucide-react';

interface GenerateCaseForm {
  name: string;
  start_url: string;
  instruction: string;
}

interface GenerateCaseModalProps {
  form: GenerateCaseForm;
  generating: boolean;
  onFormChange: (form: GenerateCaseForm) => void;
  onClose: () => void;
  onGenerate: () => void;
}

export default function GenerateCaseModal({
  form,
  generating,
  onFormChange,
  onClose,
  onGenerate,
}: GenerateCaseModalProps) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.16)] w-full max-w-4xl p-10 flex flex-col relative overflow-hidden">
        <div className="relative z-10 flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900 flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-[#10a37f]/10 rounded-xl border border-[#10a37f]/20">
                <SquareTerminal className="w-6 h-6 text-[#10a37f]" />
              </div>
              自然语言生成用例 (NL2Case)
            </h2>
            <p className="text-sm text-zinc-600 pl-14">通过大语言模型，将人类自然语言描述自动转化为结构化的自动化测试用例。</p>
          </div>
          <button onClick={onClose} disabled={generating} className="text-zinc-500 hover:text-zinc-900 transition-colors hover:bg-zinc-100 p-2 rounded-full disabled:opacity-50">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider pl-1">用例名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-3.5 text-base text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
                placeholder="例如：登录并验证欢迎提示"
                disabled={generating}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider pl-1">初始 URL (Start URL)</label>
              <input
                type="text"
                value={form.start_url}
                onChange={(e) => onFormChange({ ...form, start_url: e.target.value })}
                className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-3.5 text-base text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
                placeholder="例如：https://example.com/login"
                disabled={generating}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider pl-1">自然语言操作步骤</label>
            <textarea
              value={form.instruction}
              onChange={(e) => onFormChange({ ...form, instruction: e.target.value })}
              className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-4 text-base text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400 min-h-[280px] custom-scrollbar resize-none leading-relaxed"
              placeholder={`请输入您的测试步骤，大模型会自动拆解为结构化动作。\n\n例如：\n1. 点击右上角的登录按钮\n2. 在账号输入框输入 admin\n3. 密码输入 123456\n4. 点击确认登录按钮\n5. 断言页面上出现了“欢迎回来”的提示文本`}
              disabled={generating}
            />
          </div>
        </div>

        <div className="relative z-10 mt-10 flex justify-end gap-4">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-6 py-3 rounded-xl text-base font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="px-8 py-3 rounded-xl text-base font-medium text-white bg-[#10a37f] hover:bg-[#0e8a6a] flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {generating ? <RotateCw className="w-5 h-5 animate-spin" /> : <Terminal className="w-5 h-5" />}
            {generating ? 'AI 拆解生成中...' : '开始生成用例'}
          </button>
        </div>
      </div>
    </div>
  );
}
