import React from 'react';
import { Tag, ExternalLink, TrendingUp, AlertTriangle, Info, Zap } from 'lucide-react';

export interface KnowledgeCardProps {
  id: string;
  country: string;
  type: string;
  title: string;
  summary: string;
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  sourceUrl?: string;
  confidenceScore?: number;
  createdAt: string;
}

const IMPACT_CONFIG = {
  low:      { color: 'bg-gray-100 text-gray-600',       icon: Info,          label: 'Low Impact' },
  medium:   { color: 'bg-blue-100 text-blue-700',       icon: TrendingUp,    label: 'Medium Impact' },
  high:     { color: 'bg-orange-100 text-orange-700',   icon: AlertTriangle, label: 'High Impact' },
  critical: { color: 'bg-red-100 text-red-700',         icon: Zap,           label: 'Critical' },
};

const KnowledgeCard: React.FC<KnowledgeCardProps> = ({
  country, type, title, summary, impactLevel, tags, sourceUrl, confidenceScore, createdAt,
}) => {
  const impact = IMPACT_CONFIG[impactLevel] ?? IMPACT_CONFIG.medium;
  const ImpactIcon = impact.icon;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{country}</span>
            <span className="text-xs text-gray-400">{type.replace(/_/g, ' ')}</span>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{title}</h3>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${impact.color}`}>
          <ImpactIcon className="w-3 h-3" />
          {impact.label}
        </span>
      </div>

      <p className="text-sm text-gray-600 leading-relaxed mb-3">{summary}</p>

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full text-xs">
              <Tag className="w-2.5 h-2.5" /> {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{new Date(createdAt).toLocaleDateString()}</span>
        <div className="flex items-center gap-3">
          {confidenceScore != null && (
            <span className="text-emerald-600 font-medium">{confidenceScore}% confidence</span>
          )}
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-600">
              <ExternalLink className="w-3 h-3" /> Source
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeCard;
