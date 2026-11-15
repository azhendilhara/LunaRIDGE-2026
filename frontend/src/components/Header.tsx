import React, { useState, useEffect } from 'react';
import {
  Satellite,
  Radio,
  Clock,
  Database,
  Info,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface HeaderProps {
  backendConnected: boolean;
  onOpenProvenance: () => void;
  onOpenDisclaimer: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  backendConnected,
  onOpenProvenance,
  onOpenDisclaimer,
}) => {
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(
        now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-teal-400 p-[1px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Satellite className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xl tracking-wider text-white font-mono">
                Luna<span className="text-cyan-400">RIDGE</span>
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-cyan-300 bg-cyan-950/70 border border-cyan-800/60 rounded">
                v0.5.0 • NASA Space Apps
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden md:block">
              Radio, Illumination & Direct-to-Earth Geometry Evaluator
            </p>
          </div>
        </div>

        {/* Status and Action controls */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* UTC Clock */}
          <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{utcTime || 'SYNCING UTC...'}</span>
          </div>

          {/* Backend Health Status */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              backendConnected
                ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                : 'bg-rose-950/60 border-rose-800/60 text-rose-300'
            }`}
            title={backendConnected ? 'Backend REST API connected' : 'Backend connection unavailable'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendConnected
                  ? 'bg-emerald-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span className="hidden sm:inline">
              {backendConnected ? 'Core Engine Online' : 'Core Engine Offline'}
            </span>
          </div>

          {/* Provenance Pill */}
          <button
            onClick={onOpenProvenance}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 text-xs font-medium transition cursor-pointer"
            title="Inspect NASA data sources & ephemeris frames"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">NASA Provenance</span>
          </button>

          {/* Aerospace Advisory Pill */}
          <button
            onClick={onOpenDisclaimer}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 text-xs font-medium transition cursor-pointer"
            title="Geometric LOS vs RF link budget disclaimer"
          >
            <Radio className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">RF Advisory</span>
          </button>
        </div>
      </div>
    </header>
  );
};
