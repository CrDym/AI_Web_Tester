import { BrainCircuit, History, KeyRound, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import SoloLogo from './SoloLogo';

interface AuthGateProps {
  authMode: 'login' | 'setup';
  username: string;
  password: string;
  submitting: boolean;
  error: string;
  onModeChange: (mode: 'login' | 'setup') => void;
  onUsernameChange: (username: string) => void;
  onPasswordChange: (password: string) => void;
  onErrorClear: () => void;
  onSubmit: () => void;
}

export default function AuthGate({
  authMode,
  username,
  password,
  submitting,
  error,
  onModeChange,
  onUsernameChange,
  onPasswordChange,
  onErrorClear,
  onSubmit,
}: AuthGateProps) {
  const selectMode = (mode: 'login' | 'setup') => {
    onModeChange(mode);
    onErrorClear();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto solo-auth-shell dark:bg-black px-4 py-8">
      <div className="min-h-full flex items-center justify-center">
        <div className="grid w-[980px] max-w-[96vw] overflow-hidden rounded-[26px] border border-zinc-200/90 bg-white/96 shadow-[0_28px_90px_rgba(24,24,27,0.13)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative hidden min-h-[590px] overflow-hidden border-r border-zinc-200 bg-[#f6faf7] p-8 text-zinc-950 lg:flex lg:flex-col lg:justify-between dark:border-zinc-800 dark:bg-zinc-900">
            <div className="absolute inset-0 solo-grid-pattern opacity-70" />
            <div className="absolute inset-x-0 top-0 h-1 bg-[#13966f]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#13966f]/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#087653] shadow-sm dark:bg-zinc-950">
                Intent · Healing · Audit
              </div>
              <h2 className="mt-8 text-[34px] font-semibold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50">
                把 UI 自动化变成一条可诊断的工作流。
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                SOLO 连接自然语言用例、真实浏览器执行、自愈定位和运行审计，让团队不用在脆弱 selector 里反复补洞。
              </p>
            </div>
            <div className="relative grid gap-3">
              {[
                ['Intent', '步骤保留业务意图'],
                ['Heal', '定位失败自动寻找候选元素'],
                ['Audit', '日志、截图和修复建议留痕'],
              ].map(([label, body]) => (
                <div key={label} className="rounded-2xl border border-zinc-200 bg-white/85 px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{label}</div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-7 py-8 sm:px-10 lg:px-12">
            <div className="flex justify-center lg:justify-start">
              <SoloLogo
                orientation="stacked"
                subtitle=""
                className="flex flex-col items-center lg:items-start"
              />
            </div>

            <div className="mt-8">
              <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50">
                  {authMode === 'setup' ? '创建管理员账号' : '欢迎回来'}
                </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {authMode === 'setup' ? '首次初始化 SOLO，之后用登录入口进入测试工作台。' : '继续管理自然语言用例、浏览器运行和自愈审计记录。'}
                </p>
              </div>

            <div className="mt-7 grid grid-cols-2 gap-1 rounded-2xl border border-zinc-200 bg-zinc-100/70 p-1 dark:border-zinc-800 dark:bg-zinc-900">
                <button
                  onClick={() => selectMode('login')}
                className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition ${authMode === 'login' ? 'border border-zinc-200 bg-white text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
                >
                  登录
                </button>
                <button
                  onClick={() => selectMode('setup')}
                className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition ${authMode === 'setup' ? 'border border-zinc-200 bg-white text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
                >
                  注册
                </button>
              </div>

            <div className="mt-5 space-y-3">
                <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center text-zinc-400">
                    <UserRound className="w-4 h-4" />
                  </div>
                  <input
                    value={username}
                    onChange={(e) => onUsernameChange(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-3.5 pl-11 pr-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#13966f]/55 focus:ring-4 focus:ring-[#13966f]/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    placeholder="用户名"
                    autoFocus
                  />
                </div>
                <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center text-zinc-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => onPasswordChange(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-3.5 pl-11 pr-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#13966f]/55 focus:ring-4 focus:ring-[#13966f]/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    placeholder="密码"
                    onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
                  />
                </div>
              </div>

              {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                onClick={onSubmit}
                disabled={submitting || !username.trim() || !password}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#13966f] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(19,150,111,0.22)] hover:bg-[#087653] disabled:opacity-45 disabled:hover:bg-[#13966f]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>验证中...</span>
                  </>
                ) : (
                  <span>{authMode === 'setup' ? '创建账号并进入 SOLO' : '进入 SOLO'}</span>
                )}
              </button>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-[#f7faf8] p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: BrainCircuit, label: '意图' },
                    { icon: ShieldCheck, label: '自愈' },
                    { icon: History, label: '审计' },
                  ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-zinc-200 bg-white px-2 py-2 text-center dark:border-zinc-800 dark:bg-zinc-950">
                    <item.icon className="mx-auto w-4 h-4 text-[#13966f]" />
                      <div className="mt-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
