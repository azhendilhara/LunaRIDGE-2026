/** API and datetime-local values without an offset explicitly mean UTC. */
export const utcDate = (value: string): Date => {
  const text = value.trim().replace(' ', 'T');
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text.length === 10 ? text + 'T00:00:00' : text}Z`);
};

export const scenarioKey = (value: object): string => JSON.stringify(value, Object.keys(value).sort());

/** Identity of modeled inputs only; assessment requirements are a separate state domain. */
export function scientificScenarioKey(value: {latitude:number;longitude:number;start_time:string;stop_time:string;step_size?:string;observer_height_m?:number;horizon_azimuth_step_deg?:number;horizon_max_distance_km?:number}):string {
  const timeKey=(text:string)=>{const date=utcDate(text);return Number.isFinite(date.getTime())?date.toISOString():text;};
  return scenarioKey({latitude:value.latitude,longitude:value.longitude,start_time:timeKey(value.start_time),stop_time:timeKey(value.stop_time),step_size:value.step_size??'1h',observer_height_m:value.observer_height_m??2,horizon_azimuth_step_deg:value.horizon_azimuth_step_deg??1,horizon_max_distance_km:value.horizon_max_distance_km??50});
}

/** A shared generation guard for success, error, and loading updates. */
export class LatestRequest {
  private generation = 0;
  begin(): number { return ++this.generation; }
  isCurrent(id: number): boolean { return id === this.generation; }
  invalidate(): void { ++this.generation; }
}
