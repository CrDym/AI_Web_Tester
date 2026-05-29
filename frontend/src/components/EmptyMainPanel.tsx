import { SquareTerminal } from 'lucide-react';

export default function EmptyMainPanel() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center p-10 rounded-3xl border border-zinc-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
        <div className="w-12 h-12 rounded-2xl bg-[#10a37f]/10 border border-[#10a37f]/20 flex items-center justify-center mb-6">
          <SquareTerminal className="w-6 h-6 text-[#10a37f]" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">SOLO 测试控制台</h2>
        <p className="text-sm text-zinc-500">请选择一个用例或套件开始</p>
      </div>
    </div>
  );
}
