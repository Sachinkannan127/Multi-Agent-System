import React from 'react';
import { Loader2 } from 'lucide-react';

export const Loader = ({ label = 'Processing...' }) => {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-900/10 border border-purple-500/20 text-purple-300 text-xs font-semibold animate-pulse">
      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
      <span>{label}</span>
    </div>
  );
};
