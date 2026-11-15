import {OpportunityFinder} from './components/OpportunityFinder';
import {safeTransfer} from './utils/opportunity';
import type {CandidateTransfer} from './utils/opportunity';
import {MissionAssessment} from './components/MissionAssessment';
import { SitePicker, WorkflowNav, SimpleControls, ResultSummary, Glossary } from './components/MissionExplorer';
import { utcDate, scientificScenarioKey, LatestRequest } from './utils/scenario';
import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ControlsPanel } from './components/ControlsPanel';
import { MetricCards } from './components/MetricCards';
import { ElevationChart } from './components/ElevationChart';
import { ClearanceChart } from './components/ClearanceChart';
import { TimelineBar } from './components/TimelineBar';
import { HorizonAzimuthChart } from './components/HorizonAzimuthChart';
import { WindowsTable } from './components/WindowsTable';
import { InteractiveLunarMap } from './components/InteractiveLunarMap';
import { LandingSiteComparison } from './components/LandingSiteComparison';
import { EngineeringDisclaimer } from './components/EngineeringDisclaimer';
import { ProvenanceModal } from './components/ProvenanceModal';
import { AnalysisRequest, AnalysisResponse } from './types/api';
import { LunarSitePreset } from './constants/presets';
import { runVisibilityAnalysis, checkBackendHealth } from './services/api';
type TabType = 'finder' | 'overview' | 'map' | 'plan' | 'compare' | 'charts' | 'horizon' | 'windows';

export const App: React.FC = () => {
  // Mission request state (supports URL query params e.g. ?lat=-85.99&lon=2.93)
  const [request, setRequest] = useState<AnalysisRequest>(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = params.get('lat') ? parseFloat(params.get('lat')!) : -89.90;
    const lon = params.get('lon') ? parseFloat(params.get('lon')!) : 0.00;
    const start = utcDate(params.get('start') || '2026-11-06T00:00:00').toISOString().slice(0, 19);
    const stop = utcDate(params.get('stop') || '2026-11-07T12:00:00').toISOString().slice(0, 19);
    return {
      latitude: lat,
      longitude: lon,
      start_time: start,
      stop_time: stop,
      step_size: params.get('step') || '1h',
      observer_height_m: 2.0,
      horizon_azimuth_step_deg: 1.0,
      horizon_max_distance_km: 50.0,
    };
  });

  const [result, setResponse] = useState<AnalysisResponse | null>(null);
  const gate = useRef(new LatestRequest());
  const [submitted, setSubmitted] = useState<AnalysisRequest | null>(null);
  const stale = !!result && submitted !== null && scientificScenarioKey(request) !== scientificScenarioKey(submitted);
  const response = stale ? null : result;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendConnected, setBackendConnected] = useState<boolean>(true);

  // Modals
  const [showProvenance, setShowProvenance] = useState<boolean>(false);
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(false);

  // Active view tab for desktop (supports URL query param ?tab=map, ?tab=compare, etc.)
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as TabType;
    if (['overview', 'map', 'plan', 'compare', 'charts', 'horizon', 'windows', 'finder'].includes(tab)) {
      return tab;
    }
    return 'map';
  });

  const [mode, setMode] = useState<'simple' | 'engineering'>('simple');


  const [editField,setEditField]=useState<'date'|'site'|'mast'|null>(null);
  const editScenario=(field:'date'|'site'|'mast')=>{setMode(field==='mast'?'engineering':'simple');setActiveTab('plan');setEditField(field);};
  useEffect(()=>{
    if(!editField || activeTab!=='plan')return;
    const frame=requestAnimationFrame(()=>{
      const field=document.querySelector<HTMLElement>(`aside[aria-label="Mission scenario"] [data-scenario-field="${editField}"]`);
      field?.focus();field?.scrollIntoView({block:'center'});setEditField(null);
    });
    return ()=>cancelAnimationFrame(frame);
  },[editField,activeTab,mode]);

  // Check health periodically
  useEffect(() => {
    let isMounted = true;
    const verifyHealth = async () => {
      try {
        await checkBackendHealth();
        if (isMounted) setBackendConnected(true);
      } catch (err) {
        if (isMounted) setBackendConnected(false);
      }
    };

    verifyHealth();
    const interval = setInterval(verifyHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Run full visibility analysis
  const handleRunAnalysis = async (switchToOverview = false) => {
    const id = gate.current.begin();
    const snapshot = Object.freeze({ ...request });
    setIsLoading(true);
    setErrorMessage(null);
    setResponse(null);
    setSubmitted(snapshot);
    setActiveTab('overview');
    try {
      const res = await runVisibilityAnalysis(snapshot);
      if (!gate.current.isCurrent(id)) return;
      setSubmitted(snapshot);
      setResponse(res);
      setBackendConnected(true);
      if (switchToOverview) {
        setActiveTab('overview');
      }
    } catch (err: any) {
      if (!gate.current.isCurrent(id)) return;
      setErrorMessage(
        err?.detail || err?.message || 'Failed to complete visibility analysis'
      );
    } finally {
      if (gate.current.isCurrent(id)) setIsLoading(false);
    }
  };

  // Invalidate outstanding responses on unmount; exploration does not auto-run analysis.
  useEffect(() => {
    return () => gate.current.invalidate();
  }, []);

  // Handle Preset selection from EmptyState or elsewhere
  const handleSelectPreset = (preset: LunarSitePreset) => {
    setRequest((prev) => ({
      ...prev,
      latitude: preset.latitude,
      longitude: preset.longitude,
    }));
  };

  // Handle map click selection
  const handleMapSelect = (lat: number, lon: number, name?: string) => {
    setRequest((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon,
    }));
  };

  const [finderOpened,setFinderOpened]=useState(false);
  const [comparisonCount,setComparisonCount]=useState(2);
  const [incomingCandidate,setIncomingCandidate]=useState<CandidateTransfer|null>(null);
  const [assessmentSeed,setAssessmentSeed]=useState<{id:string;profile:CandidateTransfer['settings']['profile'];thresholds:CandidateTransfer['settings']['thresholds']}|undefined>();
  useEffect(()=>{if(activeTab==='finder')setFinderOpened(true);},[activeTab]);
  const openCandidate=(candidate:CandidateTransfer)=>{
    if(!safeTransfer(candidate))return;
    gate.current.invalidate();setIsLoading(false);setErrorMessage(null);
    const snapshot=Object.freeze({...candidate.scenario});setRequest({...snapshot});setSubmitted(snapshot);setResponse(candidate.result);
    setAssessmentSeed({id:candidate.id,...candidate.settings});setMode('simple');setActiveTab('overview');
  };
  const compareCandidate=(candidate:CandidateTransfer)=>{
    if(!safeTransfer(candidate)||comparisonCount>=5)return;
    setIncomingCandidate(candidate);setActiveTab('compare');
  };
  const [comparisonOpened, setComparisonOpened] = useState(false);
  useEffect(() => { if (activeTab === 'compare') setComparisonOpened(true); }, [activeTab]);
  const step = activeTab === 'finder' ? 'finder' : activeTab === 'map' ? 'explore' : activeTab === 'compare' ? 'compare' : activeTab === 'plan' ? 'plan' : 'results';
  return (
    <div className="mission-app min-h-screen text-slate-100">
      <a className="skip-link" href="#mission-workspace">Skip to mission workspace</a>
      <Header backendConnected={backendConnected} onOpenProvenance={() => setShowProvenance(true)} onOpenDisclaimer={() => setShowDisclaimer(true)} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        <section hidden={step !== 'explore'} className="explorer-hero compact-intro">
          <div><div className="eyebrow">LUNAR LANDING SITE NAVIGATOR</div><h1>Explore the lunar South Pole.</h1><p>Select a location on real NASA terrain, then investigate Earth visibility and sunlight over your mission dates.</p></div>
          <button className="primary-action" onClick={() => setActiveTab('plan')}>Plan Mission →</button>
        </section>
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <WorkflowNav step={step} onNavigate={(next) => setActiveTab(next === 'finder' ? 'finder' : next === 'explore' ? 'map' : next === 'compare' ? 'compare' : next === 'plan' ? 'plan' : 'overview')} />
          <div hidden={step === 'explore'||step==='finder'} className="mode-switch" role="group" aria-label="Presentation mode">
            {(['simple','engineering'] as const).map(value => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'simple' ? 'Simple View' : 'Engineering View'}</button>)}
          </div>
        </div>
        <div id="mission-workspace" tabIndex={-1} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside hidden={step !== 'plan'} className="lg:col-span-4 space-y-4" aria-label="Mission scenario">
            {mode === 'simple' ? <SimpleControls request={request} onChange={setRequest} onRun={() => handleRunAnalysis(true)} loading={isLoading} /> : <ControlsPanel request={request} onChange={setRequest} onRunAnalysis={() => handleRunAnalysis(true)} isLoading={isLoading} onOpenMap={() => setActiveTab('map')} />}
            <Glossary />
            <p className="text-sm text-slate-400 leading-relaxed">NASA JPL Horizons + LRO/LOLA terrain.<br />Geometric visibility is not a guaranteed radio link. Sunlight availability is not electrical power.</p>
          </aside>
          <section className={`${step === 'plan' ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-5 min-w-0`} aria-label="Mission workspace">
            {stale && <div role="status" className="notice">Your inputs changed. Previous results are hidden. Run analysis to calculate this scenario.</div>}
            {errorMessage && <div role="alert" className="error-notice"><h2>Analysis unavailable</h2><p>{errorMessage}</p><p>No visibility estimate is shown. Missing terrain coverage is unknown, not zero visibility. Check the location, search radius or connection, then retry.</p></div>}
            {isLoading && <div role="status" aria-live="polite" className="notice">Calculating the submitted scenario using NASA Horizons and LOLA terrain… You can keep exploring; changed inputs will need a new analysis.</div>}
            <div hidden={step !== 'explore'}>
              <div className="explore-layout"><div className="explore-map"><InteractiveLunarMap selectedLat={request.latitude} selectedLon={request.longitude} onSelectSite={handleMapSelect} /></div>
              <aside className="scenario-card explore-site"><span className="eyebrow">SELECT YOUR DESTINATION</span><h2>Where will you explore?</h2><p>Click the terrain map, choose a landmark marker, or use a preset below.</p><SitePicker request={request} onChange={setRequest} /><button className="primary-action w-full mt-5" onClick={() => setActiveTab('plan')}>Plan from this site →</button><p className="text-sm text-slate-400 mt-4">Next: choose UTC dates. No analysis runs until you request it.</p></aside></div>
            </div>
            <div hidden={step !== 'plan'} className="planning-guide"><span className="eyebrow">PLAN MISSION</span><h2>Choose the window. Keep the science in view.</h2><p>Select your site and UTC dates in the mission panel, then run a real NASA-based analysis.</p><ol><li>Choose a map location or an illustrative preset.</li><li>Set start and end dates in UTC.</li><li>Analyze, then inspect the evaluated results and terrain limitations.</li></ol><p>Simple View uses the displayed mast and sampling settings. Switch to Engineering View to adjust them before submitting.</p><button className="secondary-action" onClick={() => setActiveTab('map')}>← Change location on the map</button></div>
            <div hidden={step !== 'results'} className="space-y-5">
              <div className="section-heading"><span className="eyebrow">RESULTS</span><h2>Your mission window</h2></div>
              <MissionAssessment seed={assessmentSeed} submitted={submitted} draft={request} result={result} busy={isLoading} active={step==='results'} engineering={mode==='engineering'} onDates={()=>editScenario('date')} onSite={()=>editScenario('site')} onMast={()=>editScenario('mast')} />
              {!response && !isLoading && <div className="empty-mission"><h3>Your scenario is ready to calculate</h3><p>Choose a location and UTC dates, then select Analyze Mission. Real computed results will appear here when data are available.</p><button className="primary-action" onClick={() => setActiveTab('plan')}>Plan a mission →</button></div>}
              {response && !isLoading && <>
                <ResultSummary result={response} radiusKm={submitted?.horizon_max_distance_km} engineering={mode==='engineering'} />
                <TimelineBar earthComm={response.earth_comm} solarPower={response.solar_power} timeRange={response.time_range} compact={mode==='simple'} />
                {mode === 'engineering' && <>
                  <details><summary>Additional metric diagnostics</summary><MetricCards earthComm={response.earth_comm} solarPower={response.solar_power} site={response.site} timeRange={response.time_range} /></details>
                  <ElevationChart data={response.data} /><ClearanceChart data={response.data} />
                  <HorizonAzimuthChart latitude={response.site.latitude} longitude={response.site.longitude} observerHeightM={response.site.observer_height_m} analysisPoints={response.data} azimuthStepDeg={submitted?.horizon_azimuth_step_deg || 1} maxDistanceKm={submitted?.horizon_max_distance_km || 50} />
                  <WindowsTable earthWindows={response.earth_comm.windows} solarWindows={response.solar_power.windows} />
                  <details className="notice"><summary>Scientific methods and limitations</summary><ul>{response.scientific_model_notes.map(note => <li key={note}>{note}</li>)}</ul><button onClick={() => setShowProvenance(true)}>NASA provenance</button></details>
                </>}
                <button className="primary-action" onClick={() => setActiveTab('compare')}>Continue to Compare →</button>
              </>}
            </div>
            <div hidden={step!=='finder'}>{finderOpened&&<OpportunityFinder baseRequest={request} comparisonCount={comparisonCount} onOpen={openCandidate} onCompare={compareCandidate}/>}</div>
            <div hidden={step !== 'compare'}>
              {comparisonOpened && <LandingSiteComparison baseRequest={request} mode={mode} incoming={incomingCandidate} onCount={setComparisonCount} />}
              <button className="secondary-action mt-4" onClick={() => setActiveTab('overview')}>← Back to mission analysis</button>
            </div>
          </section>
        </div>
        <footer className="border-t border-slate-800 pt-6 text-sm text-slate-400">Built for exploration, not mission certification. Terrain beyond the search radius and events between samples remain uncertain.</footer>
      </main>
      <EngineeringDisclaimer isOpen={showDisclaimer} onClose={() => setShowDisclaimer(false)} />
      <ProvenanceModal isOpen={showProvenance} onClose={() => setShowProvenance(false)} />
    </div>
  );
};
export default App;
