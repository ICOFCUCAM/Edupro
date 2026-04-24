import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Loader2, Target, School } from 'lucide-react';
import type { AlignmentResult } from '@/services/alignmentService';

interface AlignmentBadgeProps {
  result: AlignmentResult | null;
  schoolResult?: AlignmentResult | null;
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

const ScoreBar: React.FC<{ score: number; color: string }> = ({ score, color }) => (
  <div className="h-1.5 bg-white/50 rounded-full overflow-hidden mt-1.5">
    <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
  </div>
);

const ObjectiveList: React.FC<{ items: string[]; color: string; dotColor: string }> = ({ items, color, dotColor }) => (
  <ul className="space-y-1">
    {items.map((obj, i) => (
      <li key={i} className={`flex items-start gap-1.5 text-xs ${color}`}>
        <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0`} />
        {obj}
      </li>
    ))}
  </ul>
);

const AlignmentBadge: React.FC<AlignmentBadgeProps> = ({
  result, schoolResult, loading = false, compact = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'national' | 'school'>('national');

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
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.text}`}>
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          {cfg.emoji} {cfg.label} — {result.alignmentScore}%
        </div>
        {schoolResult && (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${LEVEL_CONFIG[schoolResult.alignmentLevel].bg} ${LEVEL_CONFIG[schoolResult.alignmentLevel].text}`}>
            <School className="w-3 h-3" />
            School: {schoolResult.alignmentScore}%
          </div>
        )}
      </div>
    );
  }

  const displayResult = schoolResult && activeTab === 'school' ? schoolResult : result;
  const displayCfg = LEVEL_CONFIG[displayResult.alignmentLevel];
  const DisplayIcon = displayCfg.icon;

  return (
    <div className={`rounded-2xl border ${displayCfg.bg} overflow-hidden`}>
      {/* Tab switcher when school result exists */}
      {schoolResult && (
        <div className="flex border-b border-white/60 bg-white/20">
          <button
            onClick={() => setActiveTab('national')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all ${
              activeTab === 'national' ? 'bg-white/50 text-gray-900' : 'text-gray-500 hover:bg-white/30'
            }`}
          >
            <Target className="w-3.5 h-3.5" /> National Curriculum
          </button>
          <button
            onClick={() => setActiveTab('school')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all ${
              activeTab === 'school' ? 'bg-white/50 text-gray-900' : 'text-gray-500 hover:bg-white/30'
            }`}
          >
            <School className="w-3.5 h-3.5" /> School Scheme
          </button>
        </div>
      )}

      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${displayCfg.text} bg-white/60`}>
          <DisplayIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${displayCfg.text}`}>
              {displayCfg.emoji}{' '}
              {activeTab === 'school' ? 'School Scheme Alignment' : 'Curriculum Alignment'}{' '}
              — {displayResult.alignmentScore}%
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/70 ${displayCfg.text}`}>
              {displayCfg.label}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              AI confidence: {displayResult.confidenceScore}%
            </span>
          </div>
          <ScoreBar score={displayResult.alignmentScore} color={displayCfg.bar} />

          {/* Compact dual summary when both scores exist and not expanded */}
          {schoolResult && !expanded && activeTab === 'national' && (
            <div className={`mt-1.5 text-xs flex items-center gap-1 ${LEVEL_CONFIG[schoolResult.alignmentLevel].text}`}>
              <School className="w-3 h-3" />
              School scheme: {schoolResult.alignmentScore}% ({LEVEL_CONFIG[schoolResult.alignmentLevel].label})
            </div>
          )}
        </div>

        <div className={`ml-2 ${displayCfg.text}`}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expandable detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/60 pt-3">
          {displayResult.matchedObjectives.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Matched objectives ({displayResult.matchedObjectives.length})
              </p>
              <ObjectiveList
                items={displayResult.matchedObjectives}
                color="text-emerald-800"
                dotColor="bg-emerald-400"
              />
            </div>
          )}

          {displayResult.missingObjectives.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                Missing objectives ({displayResult.missingObjectives.length})
              </p>
              <ObjectiveList
                items={displayResult.missingObjectives}
                color="text-red-700"
                dotColor="bg-red-400"
              />
            </div>
          )}

          {displayResult.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" /> Recommendations
              </p>
              <ObjectiveList
                items={displayResult.recommendations}
                color="text-gray-600"
                dotColor="bg-indigo-400"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlignmentBadge;
