export type SurveyQuestion = {
  id: string;
  text: string;
  kind: 'scale' | 'yesno' | 'text';
};

/** Target share per option, e.g. { "18-24": 0.2, "25-34": 0.3 }. Shares need not sum to 1. */
export type Quota = Record<string, number>;

export type TestConfig = {
  targetViewers: number;
  quotas: Partial<Record<DemographicKey, Quota>>;
  survey: SurveyQuestion[];
  attentionChecks: number;
  minWatchPct: number;
  maxPauseSec: number;
  completionRedirect?: string;
  /** Optional chapter test: only this range of each cut is shown (PRD TS-7). */
  range?: { start: number; end: number };
};

export type DemographicKey = 'age_band' | 'gender' | 'country' | 'member';

export const DEMOGRAPHIC_KEYS: DemographicKey[] = ['age_band', 'gender', 'country', 'member'];

export type SourceType = 'dropbox_replay' | 'hls' | 'mp4';

export type ResolvedSource = {
  name: string;
  durationSec: number;
  fps: number;
  width?: number;
  height?: number;
  posterUrl?: string;
  /** Upstream playlist (HLS) or file (MP4) URL. Never sent to panelists. */
  mediaUrl: string;
  kind: 'hls' | 'mp4';
  resolvedAt: number;
};

export type TestRow = {
  id: string;
  title: string;
  status: 'draft' | 'live' | 'closed';
  created_at: number;
  config: TestConfig;
  transcript: Cue[];
};

export type CutRow = {
  id: string;
  test_id: string;
  label: string;
  source_type: SourceType;
  source_url: string;
  resolved: ResolvedSource | null;
};

export type Cue = { start: number; end: number; text: string };

export type SessionRow = {
  id: string;
  test_id: string;
  cut_id: string;
  pid: string;
  age_band: string | null;
  gender: string | null;
  country: string | null;
  member: string | null;
  status: 'started' | 'watching' | 'completed' | 'screened_out' | 'abandoned';
  calib_passed: number;
  calibration: string | null;
  max_pt: number;
  pauses: number;
  pause_sec: number;
  checks_total: number;
  checks_passed: number;
  survey: string | null;
  synthetic: number;
  valid: number | null;
  exclude_reason: string | null;
  completion_code: string | null;
  created_at: number;
  last_seen: number;
  completed_at: number | null;
};

/** One 250 ms sample from the viewer's browser: [playerTime, face, attentive, tabVisible]. */
export type Sample = [pt: number, face: 0 | 1, attentive: 0 | 1, visible: 0 | 1];

export type ViewerEvent = {
  type: 'interest' | 'bored' | 'pause' | 'play' | 'seek_blocked' | 'tab_hidden' | 'tab_visible' | 'fullscreen_exit' | 'check_shown' | 'check_passed' | 'check_missed' | 'rate_blocked';
  pt: number;
  ts: number;
  data?: Record<string, unknown>;
};
