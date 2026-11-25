import fs from "fs";
import path from "path";
import { CONFIG } from "./config";
import { Job, Clip } from "./types";

// Ensure storage directories exist
export function initStorage() {
  const dirs = [
    CONFIG.STORAGE_DIR,
    CONFIG.VIDEOS_DIR,
    CONFIG.CLIPS_DIR,
    CONFIG.AUDIO_DIR,
    CONFIG.SUBS_DIR,
    CONFIG.TRANSCRIPTS_DIR,
    CONFIG.LOGOS_DIR,
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }
}

export function getAllJobs(): Job[] {
  initStorage();
  try {
    if (fs.existsSync(CONFIG.DB_FILE)) {
      const data = fs.readFileSync(CONFIG.DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed reading jobs DB:", err);
  }
  return [];
}

export function getJob(id: string): Job | undefined {
  const jobs = getAllJobs();
  return jobs.find((j) => j.id === id);
}

export function saveJob(job: Job): void {
  const jobs = getAllJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) {
    jobs[idx] = job;
  } else {
    jobs.unshift(job);
  }
  fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(jobs, null, 2), "utf-8");
}

export function updateJob(id: string, updates: Partial<Job>): Job | undefined {
  const jobs = getAllJobs();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx >= 0) {
    jobs[idx] = { ...jobs[idx], ...updates };
    if ('error' in updates && updates.error === undefined) {
      delete jobs[idx].error;
    }
    fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(jobs, null, 2), "utf-8");
    return jobs[idx];
  }
  return undefined;
}

export function updateClipFeedback(
  clipId: string,
  feedback: 'like' | 'dislike',
  note?: string
): boolean {
  initStorage();
  const jobs = getAllJobs();
  let found = false;
  for (const job of jobs) {
    if (job.clips && Array.isArray(job.clips)) {
      const clip = job.clips.find((c) => c.id === clipId);
      if (clip) {
        clip.feedback = feedback;
        clip.feedbackNote = note;
        found = true;
        break;
      }
    }
  }
  if (found) {
    fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(jobs, null, 2), "utf-8");
  }
  return found;
}

/**
 * Deletes a single job and its associated media files from disk
 */
export function deleteJob(jobId: string): boolean {
  initStorage();
  const jobs = getAllJobs();
  const job = jobs.find((j) => j.id === jobId);

  if (!job) return false;

  // Delete associated audio
  if (job.audioPath && fs.existsSync(job.audioPath)) {
    try {
      fs.unlinkSync(job.audioPath);
    } catch {}
  }

  // Delete generated clips and subtitles
  for (const clip of job.clips || []) {
    if (clip.videoPath && fs.existsSync(clip.videoPath)) {
      try {
        fs.unlinkSync(clip.videoPath);
      } catch {}
    }
    const subPath = path.join(CONFIG.SUBS_DIR, `${clip.id}.ass`);
    if (fs.existsSync(subPath)) {
      try {
        fs.unlinkSync(subPath);
      } catch {}
    }
  }

  // Delete any lingering files matching job ID prefix
  const dirs = [
    CONFIG.VIDEOS_DIR,
    CONFIG.CLIPS_DIR,
    CONFIG.AUDIO_DIR,
    CONFIG.SUBS_DIR,
  ];
  for (const d of dirs) {
    if (fs.existsSync(d)) {
      const files = fs.readdirSync(d);
      for (const f of files) {
        if (f.startsWith(jobId)) {
          try {
            fs.unlinkSync(path.join(d, f));
          } catch {}
        }
      }
    }
  }

  // Remove from ledger
  const filtered = jobs.filter((j) => j.id !== jobId);
  fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(filtered, null, 2), "utf-8");
  return true;
}

/**
 * Completely clears all storage media (videos, clips, audio, subtitles)
 * Resets jobs.json to [] but preserves settings.json (API keys)
 */
export function clearAllStorage(): void {
  initStorage();

  const mediaDirs = [
    CONFIG.VIDEOS_DIR,
    CONFIG.CLIPS_DIR,
    CONFIG.AUDIO_DIR,
    CONFIG.SUBS_DIR,
  ];

  for (const dir of mediaDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file === ".gitkeep") continue;
        const filePath = path.join(dir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        } catch {}
      }
    }
  }

  // Reset jobs.json
  fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify([], null, 2), "utf-8");
}
