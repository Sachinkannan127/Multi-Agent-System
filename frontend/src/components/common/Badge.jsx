import React from 'react';

export const Badge = ({ route, children }) => {
  const normRoute = (route || 'direct').toLowerCase();

  let badgeClass = 'badge-direct';
  let label = children || 'Direct LLM';

  if (normRoute.includes('rag')) {
    badgeClass = 'badge-rag';
    label = children || 'RAG Vector Search';
  } else if (normRoute.includes('tool')) {
    badgeClass = 'badge-toolcalling';
    label = children || 'Tool Calling (Tavily/ScrapeGraph)';
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${badgeClass}`}>
      {label}
    </span>
  );
};
