import React from 'react';
import { cn } from '../../lib/cn';

interface CommandCenterProps {
  onNewConnection: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ onNewConnection }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-base select-none font-mono text-text">
      {/* Main Container - Industrial bordered look */}
      <div className="relative w-full max-w-2xl mx-auto px-6 py-12 flex flex-col items-center">
        
        {/* Background Grid/Decoration (optional subtle texture) */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
             style={{ 
               backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
               backgroundSize: '40px 40px'
             }} 
        />

        {/* Header Section */}
        <div className="z-10 flex flex-col items-center mb-16 space-y-2">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight flex items-baseline gap-1">
            <span className="text-text">OxideTerm</span>
            <span className="text-green text-2xl md:text-3xl font-bold opacity-90">_v1.0</span>
          </h1>
          <div className="flex items-center gap-3 text-xs md:text-sm text-subtext-0 tracking-widest uppercase">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green animate-pulse shadow-[0_0_8px_rgba(var(--green),0.5)]"></span>
              Status: Ready
            </span>
            <span className="text-surface-2">//</span>
            <span>Protocol: SSH_RUST_CORE</span>
          </div>
        </div>

        {/* Interactive "Standard Input" Simulation */}
        <div className="w-full max-w-lg z-10 mb-12 group">
          <label className="text-[10px] uppercase tracking-widest text-subtext-1 mb-2 block pl-1">
            Standard Input
          </label>
          <button
            onClick={onNewConnection}
            className={cn(
              "relative w-full h-14 bg-surface-0/30 backdrop-blur-sm",
              "border border-surface-2 group-hover:border-green/50 transition-colors duration-300",
              "flex items-center px-4 text-left group-hover:shadow-[0_0_20px_rgba(0,0,0,0.2)]",
              "overflow-hidden focus:outline-none focus:ring-1 focus:ring-green/50"
            )}
          >
            {/* Terminal prompt symbol */}
            <span className="text-green mr-3 text-lg font-bold">➜</span>
            
            {/* Input placeholder/text */}
            <span className="text-subtext-0 text-lg group-hover:text-text transition-colors">
              init_connection
            </span>

            {/* Blinking block cursor */}
            <span className="ml-1.5 w-2.5 h-6 bg-green/70 animate-[pulse_1s_ease-in-out_infinite]" />
            
            {/* Scanline effect (subtle) */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
          </button>
          
          <div className="mt-2 flex justify-between px-1 text-[10px] text-subtext-1 font-medium tracking-wide">
             <span>waiting for signal...</span>
             <span className="group-hover:text-green transition-colors">ENTRY ALLOWED</span>
          </div>
        </div>

        {/* Keyboard Controls / Hints */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-lg z-10">
           <CommandKey hint="CMD + N" label="New Uplink" action={onNewConnection} />
           <CommandKey hint="CMD + K" label="Comms" />
           <CommandKey hint="CMD + ," label="Config" />
           <CommandKey hint="CMD + Q" label="Terminate" />
        </div>

      </div>

      {/* Footer Version/Info */}
      <div className="fixed bottom-6 text-[10px] text-surface-2 tracking-widest font-mono uppercase">
        System Architecture: Neural_Silt_v4 // Build: 2026.01.12
      </div>
    </div>
  );
};

// Helper for the keycap look
const CommandKey = ({ hint, label, action }: { hint: string, label: string, action?: () => void }) => (
  <div 
    onClick={action}
    className={cn(
      "flex flex-col items-center justify-center p-3 border border-surface-1 bg-surface-0/20",
      "hover:bg-surface-0/40 hover:border-surface-2 transition-all cursor-default group",
      action && "cursor-pointer active:scale-95"
    )}
  >
    <span className="text-xs text-subtext-0 font-bold mb-1 group-hover:text-green transition-colors">{hint}</span>
    <span className="text-[9px] text-overlay-1 uppercase tracking-wider">{label}</span>
  </div>
);
