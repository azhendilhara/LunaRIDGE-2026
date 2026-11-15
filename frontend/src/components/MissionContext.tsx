import React from 'react';
import type {AnalysisRequest} from '../types/api';
import {LUNAR_SOUTH_POLE_PRESETS} from '../constants/presets';
import {utcDate} from '../utils/scenario';
export function siteLabel(request:AnalysisRequest){return LUNAR_SOUTH_POLE_PRESETS.find(p=>Math.abs(p.latitude-request.latitude)<.000001&&Math.abs(p.longitude-request.longitude)<.000001)?.name || 'Selected map location';}
export function MissionContext({request,profile}:{request:AnalysisRequest;profile:string}) {
 const date=(text:string)=>{const d=utcDate(text);return Number.isFinite(d.getTime())?d.toISOString().slice(0,19).replace('T',' '):'Choose dates';};
 return <div className="mission-context" aria-label="Mission context"><span><strong title="Preset names are approximate labels, not certified landing sites.">{siteLabel(request)}</strong> · {request.latitude}°, {request.longitude}° east-positive</span><span>{date(request.start_time)} → {date(request.stop_time)} UTC</span><span title="The profile changes editable requirements, not NASA results.">{profile} profile</span></div>;
}
