import { Eye } from 'lucide-react';
import type { HealEvent, RunDetail } from '../types';
import { formatTokenUsage } from '../utils/formatters';
import { getHealApprovalCandidate } from '../utils/healApproval';

interface RunHealEventsPanelProps {
  run: RunDetail;
  selectedRunId: string | null;
  approvedHeals: Record<string, boolean>;
  approvingHeals: Record<string, boolean>;
  onOpenCompare: (event: HealEvent) => void;
  onOpenScreenshot: (file: string) => void;
  onApproveHeal: (oldSelector: string, newSelector: string, intent: string) => void;
}

export default function RunHealEventsPanel({
  run,
  selectedRunId,
  approvedHeals,
  approvingHeals,
  onOpenCompare,
  onOpenScreenshot,
  onApproveHeal,
}: RunHealEventsPanelProps) {
  const events = run.heal_events || [];

  return (
    <div className="pt-2 border-t border-zinc-200">
      <div className="text-xs font-semibold text-zinc-500 mb-3">
        自愈记录（{events.length}）
      </div>
      {events.length === 0 ? (
        <div className="text-xs text-zinc-500">本次运行未发生自愈</div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-auto pr-1">
          {events.map((event, idx) => (
            <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-xl-full ${event.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <div className="text-xs text-zinc-900 truncate flex-1">{event.intent || '自愈'}</div>
                <div className="text-[10px] text-zinc-500 font-mono shrink-0">{event.source || ''}</div>
              </div>
              <div className="mt-1 text-[10px] text-zinc-500 font-mono">
                {formatTokenUsage(event.token_usage)}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500 font-mono break-all">
                {event.original_selector || ''}
              </div>
              {event.new_selector || event.new_id ? (
                <div className="mt-1 text-[11px] text-zinc-600 font-mono break-all">
                  {event.new_selector ? event.new_selector : `id:${event.new_id}`}
                </div>
              ) : null}
              {event.reason ? (
                <div className="mt-1 text-[11px] text-zinc-600 break-words">
                  {event.reason}
                </div>
              ) : null}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {event.before_file && event.after_file && selectedRunId ? (
                  <button
                    onClick={() => onOpenCompare(event)}
                    className="text-[10px] px-2 py-1 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-medium flex items-center gap-1 transition-colors"
                  >
                    <Eye className="w-3 h-3" /> 对比视图
                  </button>
                ) : null}
                {event.before_file && selectedRunId && !event.after_file ? (
                  <button
                    onClick={() => onOpenScreenshot(event.before_file as string)}
                    className="text-[10px] px-2 py-1 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700"
                  >
                    自愈前截图
                  </button>
                ) : null}
                {event.after_file && selectedRunId && !event.before_file ? (
                  <button
                    onClick={() => onOpenScreenshot(event.after_file as string)}
                    className="text-[10px] px-2 py-1 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700"
                  >
                    自愈后截图
                  </button>
                ) : null}
                {event.success && (event.new_selector || event.new_id) ? (
                  <ApproveHealButton
                    run={run}
                    event={event}
                    approvedHeals={approvedHeals}
                    approvingHeals={approvingHeals}
                    onApproveHeal={onApproveHeal}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ApproveHealButtonProps {
  run: RunDetail;
  event: HealEvent;
  approvedHeals: Record<string, boolean>;
  approvingHeals: Record<string, boolean>;
  onApproveHeal: (oldSelector: string, newSelector: string, intent: string) => void;
}

function ApproveHealButton({
  run,
  event,
  approvedHeals,
  approvingHeals,
  onApproveHeal,
}: ApproveHealButtonProps) {
  const candidate = getHealApprovalCandidate(run, event);
  if (!candidate) return null;
  const approved = !!approvedHeals[candidate.key];
  const approving = !!approvingHeals[candidate.key];

  return (
    <button
      onClick={() => onApproveHeal(candidate.oldSelector, candidate.newSelector, candidate.intent)}
      disabled={approved || approving}
      className={`text-[10px] px-2 py-1 rounded-xl border ml-auto transition-colors ${
        approved
          ? 'border-emerald-200 text-emerald-700 bg-emerald-50 cursor-default'
          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
      } ${approving ? 'opacity-70' : ''} disabled:opacity-60`}
    >
      {approved ? '已批准' : approving ? '审批中...' : '批准更新'}
    </button>
  );
}
