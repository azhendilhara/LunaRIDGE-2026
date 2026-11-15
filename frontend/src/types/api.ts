/**
 * Type definitions matching LunaRIDGE Python FastAPI backend schemas.
 */

export interface AnalysisRequest {
  latitude: number;
  longitude: number;
  start_time: string;
  stop_time: string;
  step_size?: string;
  observer_height_m?: number;
  horizon_azimuth_step_deg?: number;
  horizon_max_distance_km?: number;
}

export interface TargetVisibilityPoint {
  azimuth_deg: number;
  elevation_deg: number;
  horizon_elevation_deg: number;
  clearance_deg: number;
  visible: boolean;
  los_status: 'VISIBLE' | 'BLOCKED_BY_TERRAIN' | 'BELOW_GEOMETRIC_HORIZON' | string;
  disk_occlusion: 'FULLY_VISIBLE' | 'PARTIAL_LIMB' | 'FULLY_BLOCKED' | string;
}

export interface AnalysisPoint {
  timestamp: string;
  earth: TargetVisibilityPoint;
  sun: TargetVisibilityPoint;
}

export interface VisibilityWindow {
  window_index: number;
  start_time: string;
  end_time: string;
  duration_hours: number;
  first_sample_time: string;
  last_sample_time: string;
  sample_count: number;
  peak_elevation_deg: number;
  min_clearance_deg: number;
  max_clearance_deg: number;
}

export interface TargetSummary {
  total_visible_hours: number;
  total_blocked_hours: number;
  total_interval_hours: number;
  visibility_percentage: number;
  full_disk_visible_hours: number;
  partial_limb_hours: number;
  fully_blocked_hours: number;
  window_count: number;
  longest_window_hours: number;
  longest_blackout_hours: number;
  transition_estimation_method: string;
  sampling_uncertainty_note: string;
  windows: VisibilityWindow[];
}

export interface SiteInfo {
  latitude: number;
  longitude: number;
  ground_elevation_m: number;
  observer_height_m: number;
  total_altitude_m: number;
  reference_frame: string;
  datum: string;
}

export interface TimeRangeSummary {
  requested_start_time?: string;
  requested_stop_time?: string;
  start_time: string;
  stop_time: string;
  step_size: string;
  total_points: number;
  elapsed_hours: number;
  time_step_precision: string;
}

export interface AnalysisResponse {
  status: string;
  submitted_scenario?: AnalysisRequest;
  site: SiteInfo;
  time_range: TimeRangeSummary;
  scientific_model_notes: string[];
  earth_comm: TargetSummary;
  solar_power: TargetSummary;
  data: AnalysisPoint[];
}

export interface HorizonPoint {
  azimuth_deg: number;
  horizon_elevation_deg: number;
  obstacle_distance_m: number;
  obstacle_latitude?: number | null;
  obstacle_longitude?: number | null;
  obstacle_elevation_m?: number | null;
}

export interface ObserverTerrainInfo {
  latitude: number;
  longitude: number;
  ground_elevation_m: number;
  observer_height_m: number;
  total_altitude_m: number;
}

export interface HorizonProfileRequest {
  latitude: number;
  longitude: number;
  observer_height_m?: number;
  azimuth_start_deg?: number;
  azimuth_end_deg?: number;
  azimuth_step_deg?: number;
  max_distance_km?: number;
  sample_step_m?: number;
}

export interface HorizonProfileResponse {
  status: string;
  observer: ObserverTerrainInfo;
  azimuth_convention: string;
  reference_frame: string;
  dem_source: string;
  count: number;
  profile: HorizonPoint[];
}

export interface ElevationResponse {
  status: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  projected_x_m: number;
  projected_y_m: number;
  dem_source: string;
  reference_datum: string;
}
