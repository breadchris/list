import React, { useState } from 'react';
import { Check, X, FileText, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface WikiActionCardProps {
  path: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  onApprove: () => void;
  onReject: () => void;
}

export function WikiActionCard({
  path,
  content,
  status,
  onApprove,
  onReject
}: WikiActionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Preview logic: truncate if too long
  const previewLimit = 150;
  const isLong = content.length > previewLimit;
  const displayContent = isExpanded ? content : (isLong ? content.slice(0, previewLimit) + '...' : content);

  if (status === 'rejected') {
    return (
      <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-600 flex items-center gap-2 opacity-70">
        <X className="w-4 h-4" />
        <span>Update to <strong>{path}</strong> cancelled.</span>
      </div>
    );
  }

  if (status === 'completed' || status === 'approved') {
    return (
      <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
        <Check className="w-4 h-4" />
        <span>Updated <strong>{path}</strong> successfully.</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-indigo-100 rounded-xl shadow-sm overflow-hidden mt-2 max-w-md animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-indigo-50/50 p-3 border-b border-indigo-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 p-1.5 rounded-md text-indigo-600">
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-xs text-indigo-900">
            <span className="font-semibold block">Wiki Update Proposed</span>
            <span className="opacity-70 font-mono">{path}</span>
          </div>
        </div>
      </div>
      
      <div className="p-3">
        <div className="bg-slate-50 rounded-md p-3 text-xs text-slate-700 font-mono mb-3 border border-slate-100 relative group">
          {displayContent}
          {isLong && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-1 text-indigo-500 hover:underline font-sans"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-transparent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onApprove}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Approve & Save
          </button>
        </div>
      </div>
    </div>
  );
}
