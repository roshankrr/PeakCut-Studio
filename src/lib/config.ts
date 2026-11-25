import path from 'path';
import fs from 'fs';

export const CONFIG = {
  get BIN_YTDLP() {
    return path.join(process.cwd(), 'bin', 'yt-dlp');
  },
  get BIN_FFMPEG() {
    try {
      const ffmpeg = require('ffmpeg-static');
      return ffmpeg || 'ffmpeg';
    } catch {
      return 'ffmpeg';
    }
  },
  get BIN_FFPROBE() {
    try {
      const ffprobe = require('ffprobe-static');
      return ffprobe.path || 'ffprobe';
    } catch {
      return 'ffprobe';
    }
  },
  STORAGE_DIR: path.join(process.cwd(), 'storage'),
  VIDEOS_DIR: path.join(process.cwd(), 'storage', 'videos'),
  CLIPS_DIR: path.join(process.cwd(), 'storage', 'clips'),
  AUDIO_DIR: path.join(process.cwd(), 'storage', 'audio'),
  SUBS_DIR: path.join(process.cwd(), 'storage', 'subtitles'),
  TRANSCRIPTS_DIR: path.join(process.cwd(), 'storage', 'transcripts'),
  LOGOS_DIR: path.join(process.cwd(), 'storage', 'logos'),
  SETTINGS_FILE: path.join(process.cwd(), 'storage', 'settings.json'),
  LEARNING_FILE: path.join(process.cwd(), 'storage', 'learning_memory.json'),
  INSTAGRAM_AUTH_FILE: path.join(process.cwd(), 'storage', 'instagram_auth.json'),
  DB_FILE: path.join(process.cwd(), 'storage', 'jobs.json'),
};

export interface AppSettings {
  groqApiKey?: string;
  geminiApiKey?: string;
  youtubeClientId?: string;
  youtubeClientSecret?: string;
  instagramAppId?: string;
  instagramAppSecret?: string;
}

export function getSettings(): AppSettings {
  try {
    if (fs.existsSync(CONFIG.SETTINGS_FILE)) {
      const data = fs.readFileSync(CONFIG.SETTINGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read settings file:', err);
  }
  return {
    groqApiKey: process.env.GROQ_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
  };
}

export function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(CONFIG.SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}
