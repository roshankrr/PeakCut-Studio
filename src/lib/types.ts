export type CaptionStyle = 'bounce' | 'hype' | 'clean';
export type FrameLayout = 'blurred-fill' | 'smart-crop' | 'center-crop';
export type TemplateId = 'viral-clipper' | 'versus-comparison' | 'gaming-split' | 'stream-stepper' | 'brand-campaign';

export type LogoPosition =
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-right'
  | 'top-center'
  | 'bottom-center'
  | 'center'
  | 'custom';

export interface LogoOverlay {
  id?: string;
  url?: string;            // Web URL (e.g. /api/logos/logo_123.png or data URL)
  path?: string;           // Absolute disk path on server (e.g. /storage/logos/logo_123.png)
  name?: string;           // Original filename
  position: LogoPosition;  // 'bottom-left' by default
  xPercent?: number;       // 0 to 100
  yPercent?: number;       // 0 to 100
  widthPercent?: number;   // 8 to 40 (default: 18)
  opacity?: number;        // 0.1 to 1.0 (default: 1.0)
  campaignTag?: string;    // Optional tagline, e.g. "#Sponsored" or "Partner"
}

export interface StreamStepperState {
  chunkDuration: number; // in seconds, e.g. 1200 (20m) or 1800 (30m)
  currentChunkIndex: number; // 0-indexed (0 = Part 1, 1 = Part 2, etc.)
  totalChunks: number;
  chunkStartTime: number; // in seconds, e.g. 0
  chunkEndTime: number; // in seconds, e.g. 1200
  totalDuration: number; // total stream duration in seconds
  completedChunks: number[]; // e.g. [0, 1]
}

export interface TextOverlay {
  id: string;
  text: string;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  fontSize?: number;
  fontColor?: string;
  bgColor?: string;
  style?: 'badge' | 'banner' | 'clean';
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WordTimestamp[];
}

export interface HeatmapPoint {
  start_time: number;
  end_time: number;
  value: number;
}

export interface ClipMoment {
  id: string;
  startTime: number;
  endTime: number;
  score: number;
  reason: string;
  hook: string;
  title: string;
  description: string;
  hashtags: string[];
  wordsScore: number;
  reactionScore: number;
  heatmapScore?: number;
  matchedUserPrompt?: boolean;
}

export interface Clip {
  id: string;
  jobId: string;
  title: string;
  hook: string;
  startTime: number;
  endTime: number;
  duration: number;
  score: number;
  style: CaptionStyle;
  layout: FrameLayout;
  videoPath: string;
  publicUrl: string;
  description: string;
  hashtags: string[];
  matchedUserPrompt?: boolean;
  partNumber?: number;
  chunkRange?: string;
  feedback?: 'like' | 'dislike';
  feedbackNote?: string;
  overlays?: TextOverlay[];
  logoOverlay?: LogoOverlay;
  youtubeUrl?: string;
  instagramUrl?: string;
  createdAt: string;
}

export type JobStatus =
  | 'pending'
  | 'downloading'
  | 'extracting_audio'
  | 'transcribing'
  | 'scoring'
  | 'rendering'
  | 'completed'
  | 'failed';

export interface Job {
  id: string;
  title?: string;
  sourceUrl?: string;
  inputFilename?: string;
  videoPath?: string;
  audioPath?: string;
  duration?: number;
  hasHeatmap?: boolean;
  templateId?: TemplateId;
  stepper?: StreamStepperState;
  logoOverlay?: LogoOverlay;
  userPrompt?: string;
  status: JobStatus;
  progress: number;
  statusMessage: string;
  captionStyle: CaptionStyle;
  frameLayout: FrameLayout;
  clips: Clip[];
  error?: string;
  createdAt: string;
}

export interface FeedbackRecord {
  id: string;
  clipId: string;
  jobId?: string;
  type: 'like' | 'dislike';
  userPrompt?: string;
  clipTitle?: string;
  clipHook?: string;
  reason?: string;
  userNote?: string;
  createdAt: string;
}

export interface LearnedRule {
  id: string;
  rule: string;
  category: 'context_matching' | 'virality' | 'clip_length' | 'avoidance';
  source: 'user_dislike' | 'user_like' | 'core_system';
  weight: number;
  createdAt: string;
}

export interface LearningMemory {
  version: number;
  totalLikes: number;
  totalDislikes: number;
  learnedRules: LearnedRule[];
  promptAdditions: string[];
  recentFeedback: FeedbackRecord[];
}

