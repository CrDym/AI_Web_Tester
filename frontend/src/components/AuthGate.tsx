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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f6f7f6] dark:bg-black px-4 py-8">
      <div className="min-h-full flex items-center justify-center">
        <div className="w-[520px] max-w-[94vw]">
          <div className="mb-4 flex items-center justify-center gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            <span className="h-px w-10 bg-zinc-200 dark:bg-zinc-800" />
            Intent · Healing · Audit
            <span className="h-px w-10 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-[0_20px_70px_rgba(24,24,27,0.10)]">
            <div className="px-8 pt-8 pb-6">
              <div className="flex justify-center">
                <SoloLogo
                  orientation="stacked"
                  subtitle=""
                  className="flex flex-col items-center"
                />
              </div>

              <div className="mt-6">
                <h1 className="text-2xl font-semibold leading-tight text-zinc-950 dark:text-zinc-50">
                  {authMode === 'setup' ? '创建管理员账号' : '欢迎回来'}
                </h1>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {authMode === 'setup' ? '首次初始化 SOLO，之后用登录入口进入测试工作台。' : '继续管理自然语言用例、浏览器运行和自愈审计记录。'}
                </p>
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-1 grid grid-cols-2 gap-1">
                <button
                  onClick={() => selectMode('login')}
                  className={`px-3 py-2 text-xs rounded-xl transition ${authMode === 'login' ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                >
                  登录
                </button>
                <button
                  onClick={() => selectMode('setup')}
                  className={`px-3 py-2 text-xs rounded-xl transition ${authMode === 'setup' ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                >
                  注册
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center text-zinc-400">
                    <UserRound className="w-4 h-4" />
                  </div>
                  <input
                    value={username}
                    onChange={(e) => onUsernameChange(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-3 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#10a37f]/15 focus:border-[#10a37f]/50"
                    placeholder="用户名"
                    autoFocus
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center text-zinc-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-3 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#10a37f]/15 focus:border-[#10a37f]/50"
                    placeholder="密码"
                    onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
                  />
                </div>
              </div>

              {error ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                onClick={onSubmit}
                disabled={submitting || !username.trim() || !password}
                className="mt-5 w-full bg-[#10a37f] hover:bg-[#0e8a6a] disabled:opacity-50 disabled:hover:bg-[#10a37f] text-white text-sm font-semibold px-4 py-3 rounded-xl flex items-center justify-center gap-2"
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

              <div className="mt-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: BrainCircuit, label: '意图' },
                    { icon: ShieldCheck, label: '自愈' },
                    { icon: History, label: '审计' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-2 py-2 text-center">
                      <item.icon className="mx-auto w-4 h-4 text-[#10a37f]" />
                      <div className="mt-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
