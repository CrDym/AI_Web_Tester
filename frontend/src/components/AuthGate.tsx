import { KeyRound, Loader2, SquareTerminal, UserRound } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f7f7f8] dark:bg-black">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_25%_20%,rgba(16,163,127,0.08),transparent_55%),radial-gradient(circle_at_70%_0%,rgba(0,0,0,0.06),transparent_55%)]" />
      <div className="relative w-[420px] max-w-[92vw] px-4">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-[0_12px_48px_rgba(0,0,0,0.08)]">
          <div className="px-8 pt-8 pb-7">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#10a37f]/10 border border-[#10a37f]/20 flex items-center justify-center">
                  <SquareTerminal className="w-5 h-5 text-[#10a37f]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">SOLO 测试控制台</div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">登录后才能访问任何数据</div>
                </div>
              </div>
              <div className="shrink-0 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 flex gap-1">
                <button
                  onClick={() => selectMode('login')}
                  className={`px-3 py-1.5 text-xs rounded-xl transition ${authMode === 'login' ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                >
                  登录
                </button>
                <button
                  onClick={() => selectMode('setup')}
                  className={`px-3 py-1.5 text-xs rounded-xl transition ${authMode === 'setup' ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                >
                  初始化
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center text-zinc-400">
                    <UserRound className="w-4 h-4" />
                  </div>
                  <input
                    value={username}
                    onChange={(e) => onUsernameChange(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-10 pr-3 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#10a37f]/15 focus:border-[#10a37f]/50"
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
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-10 pr-3 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#10a37f]/15 focus:border-[#10a37f]/50"
                    placeholder="密码"
                    onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                onClick={onSubmit}
                disabled={submitting || !username.trim() || !password}
                className="w-full bg-[#10a37f] hover:bg-[#0e8a6a] disabled:opacity-50 disabled:hover:bg-[#10a37f] text-white text-sm font-semibold px-4 py-3 rounded-2xl flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>验证中...</span>
                  </>
                ) : (
                  <span>{authMode === 'setup' ? '初始化并登录' : '登录'}</span>
                )}
              </button>

              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {authMode === 'setup' ? '首次使用：创建第一个账号（仅一次）' : '提示：如果已初始化，请直接登录'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
