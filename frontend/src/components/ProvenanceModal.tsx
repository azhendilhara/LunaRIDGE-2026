import React from 'react';
import { X, Database, CheckCircle, ExternalLink, ShieldCheck } from 'lucide-react';

interface ProvenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProvenanceModal: React.FC<ProvenanceModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center">
              <Database className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                NASA Scientific Data Provenance
              </h2>
              <p className="text-xs text-slate-400">
                Official Ephemerides & Lunar Orbital Laser Altimeter Datasets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
          {/* Horizons Section */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white font-mono uppercase text-xs flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>NASA JPL Solar System Dynamics (SSD) Horizons</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                DE441 Ephemeris
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Ephemerides for Earth and Sun are queried live via the official NASA JPL Horizons batch REST API. Topocentric vectors are evaluated in the lunar body-fixed <strong>MEAN_ME</strong> frame (Mean Earth / Polar Axis frame with East longitude positive). Azimuth is referenced clockwise from selenodetic North (0° = North, 90° = East).
            </p>
            <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-2">
              <span>Authority: NASA Jet Propulsion Laboratory / Caltech</span>
              <a
                href="https://ssd.jpl.nasa.gov/horizons/"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center space-x-0.5"
              >
                <span>ssd.jpl.nasa.gov</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* LOLA Section */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white font-mono uppercase text-xs flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>NASA Lunar Reconnaissance Orbiter (LRO) LOLA</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-mono">
                LDEM_80S_80MPP_ADJ (80 m/px)
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              High-resolution lunar South Polar topography from the Lunar Orbiter Laser Altimeter (LOLA) team at NASA Goddard Space Flight Center (GSFC). Stored in South Polar Stereographic projection with a standard latitude of 90°S and reference sphere radius R = 1,737.4 km.
            </p>
            <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-2">
              <span>Archive: NASA Planetary Geodesy Data Archive (PGDA)</span>
              <a
                href="https://pgda.gsfc.nasa.gov/products/90"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center space-x-0.5"
              >
                <span>pgda.gsfc.nasa.gov</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* Alignment Audit Note */}
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-900/60 text-emerald-200 text-[11px] space-y-1">
            <div className="flex items-center space-x-1.5 font-bold font-mono text-emerald-300">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>REFERENCE FRAME LIMITATION</span>
            </div>
            <p>
              LOLA uses MOON_ME / DE421. The Horizons manual specifies lunar mean-Earth DE421 surface coordinates; raw response headers identify MEAN_ME and a 1737.4 km sphere. DE441 labels the dynamical ephemeris source, not a separate surface datum. Step 13 reference checks agree within output rounding; no sub-meter terrain registration audit is claimed.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono text-xs font-bold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
