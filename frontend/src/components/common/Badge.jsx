import React from 'react';

export const Badge = ({ route }) => {
  const normalizedRoute = (route || 'direct').toLowerCase();

  const getStyle = () => {
    switch (normalizedRoute) {
      case 'rag':
        return 'badge-rag';
      case 'toolcalling':
        return 'badge-toolcalling';
      case 'direct':
        return 'badge-direct';
      default:
        return 'badge-direct';
    }
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono ${getStyle()}`}>
      Route: {normalizedRoute}
    </span>
  );
};
