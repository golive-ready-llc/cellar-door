// Wire types for the Home Assistant sensor endpoints: /api/ha-sensor returns
// current readings, /api/ha-sensor/history returns downsampled series. Both the
// routes and the components that fetch them use these, so the contract has one
// definition.

export interface SensorValue {
  value: number;
  unit: string;
}

export interface SensorResponse {
  temp: SensorValue | null;
  humidity: SensorValue | null;
  error?: string;
}

export interface DataPoint {
  time: string;
  value: number;
}

export interface SeriesResponse {
  data: DataPoint[];
  unit: string;
}

export interface HistoryResponse {
  temp: SeriesResponse | null;
  humidity: SeriesResponse | null;
  error?: string;
}

/** Body of an error answer from either endpoint (readings absent). */
export interface HaErrorResponse {
  error: string;
}
