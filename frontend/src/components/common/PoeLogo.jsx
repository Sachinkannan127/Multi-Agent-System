import React from 'react';

export const PoeLogo = ({ className = "w-6 h-6" }) => {
  return (
    <svg 
      className={className} 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="10" fill="url(#poe-brand-grad)" />
      <path 
        d="M10 10H17.5C19.9853 10 22 12.0147 22 14.5C22 16.9853 19.9853 19 17.5 19H14V22H10V10Z" 
        fill="white" 
      />
      <circle cx="16" cy="14.5" r="2" fill="#7C3AED" />
      <defs>
        <linearGradient id="poe-brand-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
    </svg>
  );
};
