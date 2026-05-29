import { SquareTerminal } from 'lucide-react';
import type { RefObject } from 'react';
import type { RunDetail } from '../types';
import { formatShotTime } from '../utils/formatters';

interface RunScreenshotPanelProps {
  isReplayMode: boolean;
  isRunning: boolean;
  screenshot: string | null;
  selectedRunId: string | null;
  selectedRun: RunDetail | null;
  selectedShotFile: string | null;
  shotCache: Record<string, string>;
  screenshotsContainerRef: RefObject<HTMLDivElement | null>;
  onSelectShotFile: (file: string) => void;
  onScreenshotChange: (screenshot: string) => void;
  loadScreenshotFile: (runId: string, file: string) => Promise<string>;
}

export default function RunScreenshotPanel({
  isReplayMode,
  isRunning,
  screenshot,
  selectedRunId,
  selectedRun,
  selectedShotFile,
  shotCache,
  screenshotsContainerRef,
  onSelectShotFile,
  onScreenshotChange,
  loadScreenshotFile,
}: RunScreenshotPanelProps) {
  const screenshots = selectedRun?.screenshots || [];

  const selectByIndex = (idx: number) => {
    if (!selectedRunId || idx < 0 || idx >= screenshots.length) return;
    const shot = screenshots[idx];
    onSelectShotFile(shot.file);
    loadScreenshotFile(selectedRunId, shot.file).then((b64) => b64 && onScreenshotChange(b64));
    const container = screenshotsContainerRef.current;
    if (container) {
      const btn = container.children[idx] as HTMLElement;
      if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  const currentIndex = screenshots.findIndex((s) => s.file === selectedShotFile);
  const canShowStrip = isReplayMode && !!selectedRunId && screenshots.length > 0;

  return (
    <div className="w-[65%] flex flex-col bg-zinc-50 min-w-0 border-l border-zinc-200">
      <div className="px-4 py-2 bg-zinc-50 text-[11px] font-semibold text-zinc-600 tracking-wider uppercase flex items-center gap-2 border-b border-zinc-200 shrink-0 relative z-10">
        {isReplayMode ? '视觉回放' : '实时画面'}
      </div>
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-transparent relative">
        <div className="flex-1 p-4 flex items-center justify-center overflow-hidden min-h-0">
          {screenshot ? (
            <div className="relative group rounded-xl shadow-[0_18px_50px_rgba(0,0,0,0.12)] border border-zinc-200 w-full h-full flex items-center justify-center bg-white min-h-0 overflow-hidden transition-all duration-300 hover:border-zinc-300">
              <img
                src={`data:image/jpeg;base64,${screenshot}`}
                alt="Current Screen"
                className="max-w-full max-h-full object-contain"
              />
              {isRunning && !isReplayMode ? (
                <>
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#10a37f] tracking-widest uppercase opacity-90">REC</span>
                    <span className="w-2 h-2 rounded-full bg-[#10a37f] animate-pulse"></span>
                  </div>
                  <div
                    className="absolute inset-0 pointer-events-none opacity-20 animate-shimmer"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(16, 163, 127, 0.04) 20%, rgba(16, 163, 127, 0.10) 50%, rgba(16, 163, 127, 0.04) 80%, transparent 100%)',
                      backgroundSize: '200% 100%',
                    }}
                  ></div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="text-center flex flex-col items-center opacity-60">
              <SquareTerminal className="w-16 h-16 mb-4 text-zinc-500" />
              <p className="text-zinc-500 text-sm">{isReplayMode ? '该次运行没有截图' : '等待执行时回传实时画面...'}</p>
            </div>
          )}
        </div>

        {canShowStrip ? (
          <div className="border-t border-zinc-200 bg-white px-4 py-3 relative z-20 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                截图缩略条（{screenshots.length}）
                {selectedShotFile ? (
                  <span className="text-[10px] text-[#0e8a6a] font-mono bg-[#10a37f]/10 px-2 py-0.5 rounded-md border border-[#10a37f]/20 normal-case tracking-normal">
                    {selectedShotFile}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectByIndex(currentIndex - 1)}
                  disabled={!selectedShotFile || currentIndex === 0}
                  className="p-1 rounded bg-white hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 border border-zinc-200 disabled:opacity-30 transition-colors"
                  title="上一张"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <button
                  onClick={() => selectByIndex(currentIndex + 1)}
                  disabled={!selectedShotFile || currentIndex === screenshots.length - 1}
                  className="p-1 rounded bg-white hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 border border-zinc-200 disabled:opacity-30 transition-colors"
                  title="下一张"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
            <div ref={screenshotsContainerRef} className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar items-center min-h-[72px]">
              {screenshots.map((s) => {
                const cacheKey = `${selectedRunId}/${s.file}`;
                const cached = shotCache[cacheKey];
                const active = selectedShotFile === s.file;
                return (
                  <button
                    key={s.file}
                    onMouseEnter={() => { if (selectedRunId) void loadScreenshotFile(selectedRunId, s.file); }}
                    onClick={async () => {
                      if (!selectedRunId) return;
                      onSelectShotFile(s.file);
                      const b64 = await loadScreenshotFile(selectedRunId, s.file);
                      if (b64) onScreenshotChange(b64);
                    }}
                    className={`shrink-0 w-24 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      active
                        ? 'border-[#10a37f] shadow-sm scale-[1.02]'
                        : 'border-zinc-200 hover:border-zinc-300 hover:scale-[1.02] opacity-70 hover:opacity-100 bg-white'
                    }`}
                    title={formatShotTime(s.ts)}
                  >
                    {cached ? (
                      <div className="w-full h-full relative">
                        <img
                          src={`data:image/jpeg;base64,${cached}`}
                          alt={s.file}
                          className="w-full h-full object-cover transition-opacity duration-200 opacity-100"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-100 relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-zinc-300 border-t-[#10a37f] rounded-full animate-spin"></div>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
