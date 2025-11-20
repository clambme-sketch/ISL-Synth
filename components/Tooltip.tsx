
import React from 'react';

interface TooltipProps {
  text: string;
  show: boolean;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, show, children }) => {
  if (!show) {
    return <>{children}</>;
  }

  return (
    <div className="relative group h-full w-full">
      {children}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-synth-gray-900 text-white text-xs font-sans font-normal tracking-normal normal-case rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
        {text}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-synth-gray-900"></div>
      </div>
    </div>
  );
};
