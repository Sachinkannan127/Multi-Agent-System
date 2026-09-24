import React from 'react';
import { Loader2 } from 'lucide-react';

export const Loader = ({ label = 'Processing request...' }) => {
  return (
    <div className="flex items-center justify-center gap-3 p-6 text-purple-400">
      <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
      <span className="text-sm font-medium text-[var(--text-muted)]">{label}</span>
    </div>
  );
};
