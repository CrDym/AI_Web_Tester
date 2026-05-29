import type { AIFixSuggestion } from '../types';
import { formatTokenUsage } from '../utils/formatters';

interface AIFixSuggestionPanelProps {
  suggestion?: AIFixSuggestion;
  fixSuggestLoading: boolean;
  applyFixLoading: boolean;
  onGenerate: () => void;
  onForceRefresh: () => void;
  onApply: () => void;
}

export default function AIFixSuggestionPanel({
  suggestion,
  fixSuggestLoading,
  applyFixLoading,
  onGenerate,
  onForceRefresh,
  onApply,
}: AIFixSuggestionPanelProps) {
  return (
    <div className="pt-3 border-t border-zinc-200">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-zinc-500">
          AI 修复建议
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onGenerate}
            disabled={fixSuggestLoading}
            className="text-[10px] px-2 py-1 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            {fixSuggestLoading ? '生成中...' : '生成'}
          </button>
          <button
            onClick={onForceRefresh}
            disabled={fixSuggestLoading}
            className="text-[10px] px-2 py-1 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            强制刷新
          </button>
        </div>
      </div>
      {suggestion ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
          {suggestion.root_cause ? (
            <div className="text-xs text-zinc-700">
              根因：<span className="text-zinc-900">{suggestion.root_cause}</span>
            </div>
          ) : null}
          <div className="text-[10px] text-zinc-500 font-mono">
            {formatTokenUsage(suggestion.token_usage)}
          </div>
          {suggestion.explanation ? (
            <div className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap">
              {suggestion.explanation}
            </div>
          ) : null}
          {suggestion.suggestions && suggestion.suggestions.length > 0 ? (
            <div className="space-y-1">
              {suggestion.suggestions.map((s, i) => (
                <div key={i} className="text-xs text-zinc-600">
                  - {s}
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onApply}
              disabled={applyFixLoading || !suggestion.patched_steps}
              className="text-[10px] px-2 py-1 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {applyFixLoading ? '应用中...' : '应用到用例'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-zinc-500">尚未生成修复建议</div>
      )}
    </div>
  );
}
