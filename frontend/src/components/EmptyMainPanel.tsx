import { Activity, BrainCircuit, FileJson, History, PlayCircle, ShieldCheck, Sparkles, SquareTerminal } from 'lucide-react';

export default function EmptyMainPanel() {
  const capabilities = [
    {
      icon: BrainCircuit,
      title: '意图优先',
      body: '用自然语言描述测试目标，selector 只是可选锚点。',
    },
    {
      icon: ShieldCheck,
      title: '失败自愈',
      body: '定位失效时由 SOLO 尝试寻找更稳定的元素路径。',
    },
    {
      icon: History,
      title: '回放审计',
      body: '每次运行保留日志、截图、诊断和修复证据。',
    },
  ];

  return (
    <div className="flex-1 overflow-auto bg-[#f7f7f8] dark:bg-black">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <div className="flex items-start justify-between gap-8 border-b border-zinc-200 dark:border-zinc-800 pb-8">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#10a37f]/20 bg-[#10a37f]/10 px-3 py-1.5 text-xs font-semibold text-[#0e8a6a]">
              <Sparkles className="w-3.5 h-3.5" />
              AI 自动化测试助手
            </div>
            <h2 className="mt-5 text-3xl font-semibold text-zinc-950 dark:text-zinc-50 leading-tight">SOLO 测试工作台</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              从自然语言用例开始，到浏览器执行、失败诊断、自愈修复和运行审计，SOLO 把测试流程收拢在一个可追踪的工作台里。
            </p>
          </div>
          <div className="hidden md:grid grid-cols-2 gap-2 w-64 shrink-0">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                <PlayCircle className="w-4 h-4 text-[#10a37f]" />
                Run
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">执行与回放</div>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                <Activity className="w-4 h-4 text-[#10a37f]" />
                Audit
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">诊断留痕</div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {capabilities.map((item) => (
            <div key={item.title} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-[#10a37f]" />
              </div>
              <div className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</div>
              <div className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.body}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
            <SquareTerminal className="w-4 h-4 text-[#10a37f]" />
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">开始工作</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
            <div className="p-5">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">1. 生成或导入用例</div>
              <div className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">在左侧选择自然语言生成，或导入已有测试描述。</div>
            </div>
            <div className="p-5">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">2. 补充关键意图</div>
              <div className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">让每一步都能被人读懂，也能被 AI 诊断和修复。</div>
            </div>
            <div className="p-5">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">3. 运行并审计结果</div>
              <div className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">查看日志、截图、自愈记录和 token 消耗。</div>
            </div>
          </div>
          <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <FileJson className="w-4 h-4" />
            请选择左侧用例或套件进入编辑与运行。
          </div>
        </div>
      </div>
    </div>
  );
}
