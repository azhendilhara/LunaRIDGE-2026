import React from 'react';
import { X, ShieldAlert, Radio, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface EngineeringDisclaimerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EngineeringDisclaimer: React.FC<EngineeringDisclaimerProps> = ({
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
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-800/80 flex items-center justify-center">
              <Radio className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                Aerospace Engineering Technical Advisory
              </h2>
              <p className="text-xs text-slate-400">
                Geometric Line-of-Sight vs Guaranteed RF Link Closure
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
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-900/60 text-amber-200 space-y-1">
            <div className="flex items-center space-x-2 font-bold font-mono text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>CRITICAL MISSION PLANNING DISTINCTION</span>
            </div>
            <p className="text-[11px] leading-normal">
              LunaRIDGE provides high-resolution <strong>geometric line-of-sight (LOS) clearance</strong> based on official NASA LOLA topography and JPL Horizons ephemerides. A positive geometric clearance ($\Delta \theta &gt; 0^\circ$) is a necessary physical prerequisite for communication, but does <em>not</em> alone guarantee closure of a functional radio frequency (RF) link.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white font-mono uppercase tracking-wide text-[11px]">
              Factors Requiring RF Link Budget Verification:
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Free-Space Path Loss (FSPL):</strong> Over the mean Earth-Moon distance (approx. 384,400 km), electromagnetic attenuation is substantial (~210 dB at S-band 2.2 GHz; ~225 dB at X-band 8.4 GHz; ~232 dB at Ka-band 26 GHz). High-gain directional antennas and cryogenic low-noise amplifiers are essential.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Antenna Gain & Pointing Jitter:</strong> High-gain rover or lander parabolic reflectors require gimbal articulation with pointing accuracy tighter than half-power beamwidth (HPBW). Rover orientation, suspension tilt, and mast deflection impact pointing.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Lunar Regolith Multipath & Diffraction:</strong> At low elevation angles (&lt; 5° above local horizon), knife-edge diffraction over crater rims and ground-bounce reflections cause Rayleigh/Rician multipath fading and signal polarization rotation.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Solar Radio Noise:</strong> When the angular separation between Earth and Sun is narrow (low Sun-Earth-Probe angle), solar microwave emission entering antenna sidelobes elevates system noise temperature (T_sys), degrading carrier-to-noise density (C/N_0).
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Terrestrial Deep Space Network (DSN) Scheduling:</strong> Ground reception requires an in-view, scheduled tracking dish (Goldstone, Madrid, or Canberra) operating with positive elevation mask ($&gt; 6^\circ$ to $10^\circ$).
                </span>
              </li>
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400">
            <strong>Recommendation:</strong> Use LunaRIDGE clearance angles and window boundaries as the primary geometric boundary conditions, followed by standard telecom link budget analysis using ITU-R / CCSDS recommendations.
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-semibold transition cursor-pointer"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
