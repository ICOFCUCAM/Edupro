import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Loader2, Target } from 'lucide-react';
import type { AlignmentResult } from '@/services/alignmentService';

interface AlignmentBadgeProps {
  result: AlignmentResult | null;
  loading?: boolean;
  compact?: boolean;
}

const LEVEL_CONFIG = {
  full: {
    icon: CheckCircle2,
    label: 'Fully Aligned',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
    emoji: '🟢',
  },
  partial: {
    icon: AlertTriangle,
    label: 'Partial Alignment',
    dot: 'bg-amber-400',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    bar: 'bg-amber-400',
    emoji: '🟡',
  },
  needs_improvement: {
    icon: XCircle,
    label: 'Needs Improvement',
    dot: 'bg-red-400',
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    bar: 'bg-red-400',
    emoji: '🔴',
  },
};

const AlignmentBadge: React.FC<AlignmentBadgeProps> = ({ result, loading = false, compact = false }) => {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Checking curriculum alignment…
      </div>
    );
  }

  if (!result) return null;

  const cfg = LEVEL_CONFIG[result.alignmentLevel];
  const Icon = cfg.icon;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.text}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        {cfg.emoji} {cfg.label} — {result.alignmentScore}%
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border ${cfg.bg} overflow-hidden`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.text} bg-white/60`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${cfg.text}`}>
              {cfg.emoji} Curriculum Alignment — {result.alignmentScore}%
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/70 ${cfg.text}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              AI confidence: {result.confidenceScore}%
            </span>
          </div>

          {/* Score bar */}
          <div className="mt-1.5 h-1.5 bg-white/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
              style={{ width: `${result.alignmentScore}%` }}
            />
          </div>
        </div>

        <div className={`ml-2 ${cfg.text}`}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expandable detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/60 pt-3">
          {result.matchedObjectives.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Matched objectives ({result.matchedObjectives.length})
              </p>
              <ul className="space-y-1">
                {result.matchedObjectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-800">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.missingObjectives.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Missing objectives ({result.missingObjectives.length})
              </p>
              <ul className="space-y-1">
                {result.missingObjectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" /> Recommendations
              </p>
              <ul className="space-y-1">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlignmentBadge;
