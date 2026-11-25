import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { CONFIG, getSettings } from './config';
import { TranscriptSegment } from './types';

export interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
  duration: number;
}

/**
 * Probes the duration of an audio file using FFprobe
 */
async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise<number>((resolve) => {
    const proc = spawn(CONFIG.BIN_FFPROBE, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);

    let output = '';
    proc.stdout.on('data', (d) => (output += d.toString()));
    proc.on('close', (code) => {
      const dur = parseFloat(output.trim());
      resolve(!isNaN(dur) && dur > 0 ? dur : 0);
    });
  });
}

/**
 * Splits an audio file into manageable chunks (default 180s = 3 minutes).
 * Slicing into 180s segments prevents hitting Groq's 7,200s hourly ASPH ceiling
 * when only small amounts of hourly quota remain, and enables per-chunk caching.
 */
async function splitAudioIntoChunks(
  inputPath: string,
  outputDir: string,
  chunkDurationSec: number = 180
): Promise<Array<{ path: string; offset: number }>> {
  const chunkPattern = path.join(outputDir, `chunk_${Date.now()}_%03d.mp3`);

  const args = [
    '-y',
    '-i',
    inputPath,
    '-f',
    'segment',
    '-segment_time',
    String(chunkDurationSec),
    '-c',
    'copy',
    chunkPattern,
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(CONFIG.BIN_FFMPEG, args);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg audio splitting failed with exit code ${code}`));
    });
  });

  // Find generated chunk files
  const files = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith('chunk_') && f.endsWith('.mp3'))
    .sort();

  return files.map((f, index) => ({
    path: path.join(outputDir, f),
    offset: index * chunkDurationSec,
  }));
}

function parseWaitTimeMs(errorText: string): number | null {
  // Matches e.g. "try again in 2m10s", "try again in 45s", "try again in 1m", "try again in 2m10.5s"
  const match = errorText.match(/try again in (?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i);
  if (match) {
    const minutes = match[1] ? parseInt(match[1], 10) : 0;
    const seconds = match[2] ? parseFloat(match[2]) : 0;
    const totalMs = (minutes * 60 + seconds + 4) * 1000; // +4s buffer
    if (totalMs > 0) return totalMs;
  }
  return null;
}

async function sendGroqTranscription(
  filePath: string,
  groqApiKey: string,
  modelName: string
): Promise<{ ok: boolean; status: number; data?: any; errorText?: string }> {
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'audio/mp3' });
  const formData = new FormData();
  formData.append('file', blob, 'audio.mp3');
  formData.append('model', modelName);
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');
  formData.append('timestamp_granularities[]', 'segment');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: formData,
  });

  if (response.ok) {
    const data = await response.json();
    return { ok: true, status: response.status, data };
  } else {
    const errorText = await response.text();
    return { ok: false, status: response.status, errorText };
  }
}

async function transcribeSingleFileWithAutoRetry(
  filePath: string,
  groqApiKey: string,
  onProgress?: (message: string) => void,
  maxAttempts: number = 4
): Promise<{ text: string; segments: any[]; words: any[]; duration: number }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 1. Try primary model: whisper-large-v3
    let res = await sendGroqTranscription(filePath, groqApiKey, 'whisper-large-v3');

    // 2. If 429 rate limit exceeded, try whisper-large-v3-turbo
    if (!res.ok && res.status === 429) {
      console.warn(`[Whisper] whisper-large-v3 returned 429. Trying whisper-large-v3-turbo...`);
      res = await sendGroqTranscription(filePath, groqApiKey, 'whisper-large-v3-turbo');
    }

    if (res.ok && res.data) {
      const data = res.data;
      return {
        text: data.text || '',
        segments: data.segments || [],
        words: data.words || [],
        duration: data.duration || 0,
      };
    }

    // 3. If 429 rate limit exceeded on both (ASPH 7,200s limit)
    if (res.status === 429 && res.errorText) {
      const waitMs = parseWaitTimeMs(res.errorText);
      // If wait time is reasonable (under 5 minutes) and we have retries left
      if (waitMs && waitMs <= 300000 && attempt < maxAttempts) {
        let remainingSec = Math.ceil(waitMs / 1000);
        console.warn(`[Whisper] Groq hourly ASPH limit reached. Auto-waiting ${remainingSec}s for rolling window...`);

        while (remainingSec > 0) {
          const mins = Math.floor(remainingSec / 60);
          const secs = remainingSec % 60;
          const timeStr = mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`;
          onProgress?.(`Groq hourly quota full (7,200s limit). Auto-cooling rolling window: ${timeStr} remaining...`);
          const sleepTime = Math.min(remainingSec, 5);
          await new Promise((r) => setTimeout(r, sleepTime * 1000));
          remainingSec -= sleepTime;
        }

        onProgress?.('Resuming Groq Whisper transcription after quota refresh...');
        continue;
      }

      // If wait time is excessive (> 5m) or retries exhausted, give friendly explanation
      throw new Error(
        `Groq Whisper hourly quota limit reached (7,200s audio per hour on free tier). Groq cooldown: ${Math.ceil(
          (waitMs || 60000) / 1000
        )}s remaining. You can wait a moment or enter another free Groq API key in Settings.`
      );
    }

    // Non-429 error
    if (attempt >= maxAttempts || res.status !== 429) {
      throw new Error(`Groq Whisper transcription failed (${res.status}): ${res.errorText}`);
    }
  }

  throw new Error('Groq Whisper transcription failed after retries');
}

/**
 * Transcribes audio with intelligent 180s chunking, per-chunk disk caching,
 * and automatic 429 rate-limit countdown handling.
 * Caches transcripts locally so repeat runs/retries consume 0 Groq audio seconds.
 */
export async function transcribeAudio(
  audioPath: string,
  onProgress?: (message: string) => void
): Promise<TranscriptionResult> {
  const settings = getSettings();
  const groqApiKey = settings.groqApiKey || process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    throw new Error(
      'Groq API key not configured. Please open Settings in PeakCut Studio and enter your free Groq API key.'
    );
  }

  // 1. Overall Transcript Cache: avoid re-sending identical audio and wasting Groq ASPH seconds
  let cacheFile: string | null = null;
  try {
    const fileBuf = fs.readFileSync(audioPath);
    const audioHash = crypto.createHash('md5').update(fileBuf).digest('hex');
    cacheFile = path.join(CONFIG.TRANSCRIPTS_DIR, `cache_${audioHash}.json`);
    if (fs.existsSync(cacheFile)) {
      const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      if (cachedData && cachedData.segments && cachedData.segments.length > 0) {
        onProgress?.('Loaded transcription from local cache (0 API audio seconds consumed).');
        return cachedData;
      }
    }
  } catch {}

  const duration = await getAudioDuration(audioPath);
  const chunkThresholdSec = 180; // 3 minutes safety threshold

  let result: TranscriptionResult;

  // Fast path: file is under 3 minutes, transcribe directly in a single call (~1-2s)
  if (duration > 0 && duration <= chunkThresholdSec) {
    onProgress?.(`Transcribing audio (${Math.round(duration)}s) with Groq Whisper...`);
    const data = await transcribeSingleFileWithAutoRetry(audioPath, groqApiKey, onProgress);
    const rawWords: Array<{ word: string; start: number; end: number }> = data.words || [];

    const segments: TranscriptSegment[] = (data.segments || []).map((seg: any, idx: number) => {
      const segWords = rawWords.filter(
        (w) => w.start >= seg.start - 0.1 && w.end <= seg.end + 0.1
      );

      return {
        id: idx,
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
        words: segWords.length > 0 ? segWords : undefined,
      };
    });

    result = {
      text: data.text || '',
      segments,
      duration: data.duration || duration,
    };
  } else {
    // Chunked path: File is longer than 3 minutes.
    // Slicing into 180s chunks keeps individual requests tiny, fast,
    // and easily fit inside remaining hourly ASPH quota.
    const chunkDuration = 180;
    const estChunks = duration > 0 ? Math.ceil(duration / chunkDuration) : 'several';
    onProgress?.(
      `Audio duration is ${Math.round(duration / 60)}m. Slicing into ~${estChunks} 3-minute chunks for Whisper quota safety...`
    );
    const chunksDir = path.join(CONFIG.AUDIO_DIR, `chunks_${Date.now()}`);
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }

    try {
      const chunks = await splitAudioIntoChunks(audioPath, chunksDir, chunkDuration);

      const allSegments: TranscriptSegment[] = [];
      const textParts: string[] = [];
      let segGlobalIndex = 0;
      let totalDuration = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkRange = `${Math.round(chunk.offset / 60)}m-${Math.round(
          (chunk.offset + chunkDuration) / 60
        )}m`;

        // Check per-chunk cache first!
        let chunkData: any = null;
        let chunkCacheFile: string | null = null;
        try {
          const chunkBuf = fs.readFileSync(chunk.path);
          const chunkHash = crypto.createHash('md5').update(chunkBuf).digest('hex');
          chunkCacheFile = path.join(CONFIG.TRANSCRIPTS_DIR, `chunk_${chunkHash}.json`);
          if (fs.existsSync(chunkCacheFile)) {
            chunkData = JSON.parse(fs.readFileSync(chunkCacheFile, 'utf-8'));
            onProgress?.(`Chunk ${i + 1}/${chunks.length} [${chunkRange}] restored from cache (0 API quota used).`);
          }
        } catch {}

        if (!chunkData) {
          onProgress?.(
            `Transcribing chunk ${i + 1}/${chunks.length} [${chunkRange}] with Groq Whisper...`
          );
          chunkData = await transcribeSingleFileWithAutoRetry(chunk.path, groqApiKey, onProgress);
          if (chunkCacheFile) {
            try {
              fs.writeFileSync(chunkCacheFile, JSON.stringify(chunkData), 'utf-8');
            } catch {}
          }
        }

        textParts.push(chunkData.text || '');
        totalDuration = Math.max(totalDuration, chunk.offset + (chunkData.duration || 0));

        const chunkWords: Array<{ word: string; start: number; end: number }> = (chunkData.words || []).map(
          (w: any) => ({
            word: w.word,
            start: w.start + chunk.offset,
            end: w.end + chunk.offset,
          })
        );

        for (const seg of chunkData.segments || []) {
          const adjustedStart = seg.start + chunk.offset;
          const adjustedEnd = seg.end + chunk.offset;

          const segWords = chunkWords.filter(
            (w) => w.start >= adjustedStart - 0.1 && w.end <= adjustedEnd + 0.1
          );

          allSegments.push({
            id: segGlobalIndex++,
            start: adjustedStart,
            end: adjustedEnd,
            text: seg.text.trim(),
            words: segWords.length > 0 ? segWords : undefined,
          });
        }

        // Clean up temporary chunk file
        try {
          fs.unlinkSync(chunk.path);
        } catch {}
      }

      result = {
        text: textParts.join(' ').trim(),
        segments: allSegments,
        duration: totalDuration || duration,
      };
    } finally {
      // Clean up temporary chunks folder
      try {
        if (fs.existsSync(chunksDir)) {
          fs.rmSync(chunksDir, { recursive: true, force: true });
        }
      } catch {}
    }
  }

  // Save full audio transcript to cache for instant 0-quota repeat runs
  if (cacheFile && result.segments && result.segments.length > 0) {
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf-8');
    } catch {}
  }

  return result;
}
