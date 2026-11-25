import path from 'path';
import fs from 'fs';
import { CONFIG } from './config';
import { Job, Clip, CaptionStyle, FrameLayout, TranscriptSegment, HeatmapPoint } from './types';
import { saveJob, updateJob, initStorage, getJob } from './storage';
import {
  getVideoMetadata,
  downloadAudioSection,
  downloadVideoSection,
  tryFetchYouTubeSubtitles,
} from './downloader';
import { analyzeAudioEnergy } from './audio';
import { transcribeAudio } from './transcriber';
import { findPeakMoments } from './judge';
import { generateAssSubtitles } from './subtitles';
import { renderVerticalClip } from './renderer';

export interface StartStepperParams {
  sourceUrl: string;
  chunkMinutes?: number; // default 20
  startChunkIndex?: number; // default 0
  captionStyle?: CaptionStyle;
  frameLayout?: FrameLayout;
  clipCount?: number;
  userPrompt?: string;
}

export function formatSecondsToTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export async function startStreamStepperJob(params: StartStepperParams): Promise<Job> {
  initStorage();

  const jobId = `job_step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const initialJob: Job = {
    id: jobId,
    sourceUrl: params.sourceUrl,
    templateId: 'stream-stepper',
    status: 'pending',
    progress: 5,
    statusMessage: 'Inspecting long VOD metadata & setting up chunk windows...',
    captionStyle: params.captionStyle || 'bounce',
    frameLayout: params.frameLayout || 'blurred-fill',
    userPrompt: params.userPrompt?.trim() || undefined,
    clips: [],
    createdAt: new Date().toISOString(),
  };

  saveJob(initialJob);

  runInitialStepper(jobId, params).catch((err) => {
    console.error(`Stream Stepper failed for job ${jobId}:`, err);
    const friendlyMsg = err.message?.includes('nodename')
      ? 'YouTube network connection or DNS lookup interrupted'
      : 'Stream Stepper initialization failed';
    updateJob(jobId, {
      status: 'failed',
      statusMessage: friendlyMsg,
      error: err.message,
    });
  });

  return initialJob;
}

async function runInitialStepper(jobId: string, params: StartStepperParams) {
  updateJob(jobId, {
    status: 'downloading',
    progress: 10,
    statusMessage: 'Fetching VOD metadata, duration & audience replay heatmap...',
  });

  let meta;
  try {
    meta = await getVideoMetadata(params.sourceUrl);
  } catch (metaErr: any) {
    throw new Error(`Failed to inspect stream metadata: ${metaErr.message}`);
  }

  const totalDuration = meta.duration || 7200; // default 2h if unknown
  const chunkMinutes = Math.min(60, Math.max(10, Number(params.chunkMinutes) || 20));
  const chunkDurationSec = chunkMinutes * 60;
  const totalChunks = Math.max(1, Math.ceil(totalDuration / chunkDurationSec));

  const startIdx = Math.max(0, Math.min(totalChunks - 1, Number(params.startChunkIndex) || 0));
  const chunkStartTime = startIdx * chunkDurationSec;
  const chunkEndTime = Math.min(totalDuration, chunkStartTime + chunkDurationSec);

  updateJob(jobId, {
    title: meta.title,
    duration: totalDuration,
    hasHeatmap: Boolean(meta.heatmap && meta.heatmap.length > 0),
    stepper: {
      chunkDuration: chunkDurationSec,
      currentChunkIndex: startIdx,
      totalChunks,
      chunkStartTime,
      chunkEndTime,
      totalDuration,
      completedChunks: [],
    },
    statusMessage: `Stream analyzed (${formatSecondsToTime(totalDuration)}). Divided into ${totalChunks} parts of ${chunkMinutes}m each. Starting Part ${startIdx + 1}...`,
  });

  // Process the first requested chunk
  await processStepperChunkInternal(jobId, startIdx, params.userPrompt);
}

/**
 * Advance to or process a specific chunk index in the stream stepper
 */
export async function advanceStepperChunk(
  jobId: string,
  targetChunkIndex?: number,
  userPrompt?: string
): Promise<Job> {
  initStorage();
  const job = getJob(jobId);
  if (!job || !job.stepper) {
    throw new Error('Stream Stepper job not found');
  }

  const nextIndex =
    typeof targetChunkIndex === 'number'
      ? targetChunkIndex
      : job.stepper.currentChunkIndex + 1;

  if (nextIndex >= job.stepper.totalChunks) {
    throw new Error(`Already reached final part (${job.stepper.totalChunks}) of this stream.`);
  }

  // Update status immediately so UI polls and updates
  const nextStartTime = nextIndex * job.stepper.chunkDuration;
  const nextEndTime = Math.min(job.stepper.totalDuration, nextStartTime + job.stepper.chunkDuration);

  updateJob(jobId, {
    status: 'downloading',
    progress: 10,
    error: undefined,
    userPrompt: userPrompt?.trim() || undefined,
    statusMessage: `Queuing Part ${nextIndex + 1}/${job.stepper.totalChunks} [${formatSecondsToTime(nextStartTime)} - ${formatSecondsToTime(nextEndTime)}]...`,
  });

  // Run in background
  processStepperChunkInternal(jobId, nextIndex, userPrompt).catch((err) => {
    console.error(`Failed processing chunk ${nextIndex} for ${jobId}:`, err);
    updateJob(jobId, {
      status: 'failed',
      statusMessage: `Failed processing Part ${nextIndex + 1}`,
      error: err.message,
    });
  });

  return getJob(jobId)!;
}

async function processStepperChunkInternal(
  jobId: string,
  chunkIndex: number,
  userPrompt?: string
) {
  const job = getJob(jobId);
  if (!job || !job.sourceUrl || !job.stepper) return;

  const { chunkDuration, totalDuration, totalChunks } = job.stepper;
  const chunkStartTime = chunkIndex * chunkDuration;
  const chunkEndTime = Math.min(totalDuration, chunkStartTime + chunkDuration);
  const partNumber = chunkIndex + 1;
  const partTimeRange = `${formatSecondsToTime(chunkStartTime)} - ${formatSecondsToTime(chunkEndTime)}`;

  updateJob(jobId, {
    status: 'downloading',
    progress: 15,
    statusMessage: `Downloading audio slice for Part ${partNumber}/${totalChunks} [${partTimeRange}] (~5MB speech stream)...`,
  });

  // STEP 1: Surgical audio range download (Only downloads ~5MB instead of 10GB!)
  const audioPrefix = `${jobId}_part${partNumber}`;
  const audioPath = await downloadAudioSection(
    job.sourceUrl,
    chunkStartTime,
    chunkEndTime,
    audioPrefix,
    (pct, msg) => {
      updateJob(jobId, { progress: pct, statusMessage: msg });
    }
  );

  // STEP 2: Caption Acquisition & Energy Analysis
  updateJob(jobId, {
    status: 'transcribing',
    progress: 40,
    statusMessage: `Extracting speech dialogue & analyzing audio peaks for Part ${partNumber}...`,
  });

  let nativeSegments: TranscriptSegment[] | null = null;
  try {
    const allSubs = await tryFetchYouTubeSubtitles(job.sourceUrl, jobId);
    if (allSubs && allSubs.length > 0) {
      // Filter segments to this chunk range
      nativeSegments = allSubs.filter(
        (s) => s.start >= chunkStartTime && s.end <= chunkEndTime
      );
    }
  } catch {}

  const energyPointsPromise = analyzeAudioEnergy(audioPath).then((points) =>
    points.map((p) => ({ ...p, time: p.time + chunkStartTime }))
  );

  const transcriptPromise =
    nativeSegments && nativeSegments.length >= 5
      ? Promise.resolve({
          segments: nativeSegments,
          duration: chunkEndTime - chunkStartTime,
        })
      : transcribeAudio(audioPath, (msg) => {
          updateJob(jobId, { statusMessage: `Part ${partNumber}: ${msg}` });
        }).then((res) => {
          // Offset Whisper relative timestamps by chunkStartTime
          const offsetSegs = (res.segments || []).map((s) => ({
            ...s,
            start: Math.round((s.start + chunkStartTime) * 10) / 10,
            end: Math.round((s.end + chunkStartTime) * 10) / 10,
            words: s.words
              ? s.words.map((w) => ({
                  ...w,
                  start: Math.round((w.start + chunkStartTime) * 10) / 10,
                  end: Math.round((w.end + chunkStartTime) * 10) / 10,
                }))
              : undefined,
          }));
          return { segments: offsetSegs, duration: chunkEndTime - chunkStartTime };
        });

  const [energyPoints, transcriptResult] = await Promise.all([
    energyPointsPromise,
    transcriptPromise,
  ]);

  // STEP 3: Scoring Peak Moments within this Chunk Window
  updateJob(jobId, {
    status: 'scoring',
    progress: 65,
    statusMessage: `AI evaluating peak moments & dialogue for Part ${partNumber}...`,
  });

  const excludeRanges = (job.clips || []).map((c) => ({
    startTime: c.startTime,
    endTime: c.endTime,
  }));

  const targetClipCount = 3;
  const moments = await findPeakMoments(
    transcriptResult.segments,
    energyPoints,
    chunkEndTime,
    undefined,
    targetClipCount,
    excludeRanges,
    false,
    userPrompt
  );

  // STEP 4: Surgical Video Slicing & Vertical 9:16 Rendering
  updateJob(jobId, {
    status: 'rendering',
    progress: 75,
    statusMessage: `Slicing and rendering ${moments.length} vertical shorts for Part ${partNumber} [${partTimeRange}]...`,
  });

  const existingClips = [...(job.clips || [])];
  const newClips: Clip[] = [];
  let clipErrors: string[] = [];

  for (let i = 0; i < moments.length; i++) {
    const moment = moments[i];
    const clipId = `${jobId}_p${partNumber}_c${i + 1}`;
    const subPath = path.join(CONFIG.SUBS_DIR, `${clipId}.ass`);
    const clipVideoPath = path.join(CONFIG.CLIPS_DIR, `${clipId}.mp4`);
    const rawSectionPath = path.join(CONFIG.VIDEOS_DIR, `${clipId}_raw.mp4`);

    updateJob(jobId, {
      progress: Math.min(95, 75 + Math.round(((i + 1) / moments.length) * 20)),
      statusMessage: `Rendering Part ${partNumber} Clip ${i + 1}/${moments.length}: "${moment.hook}"...`,
    });

    try {
      // Surgical Video Slicing for only this 30s moment (with IPv4 + automatic retry)
      await downloadVideoSection(job.sourceUrl, moment.startTime, moment.endTime, rawSectionPath);

      // Generate ASS karaoke subtitles
      generateAssSubtitles(
        transcriptResult.segments,
        moment.startTime,
        moment.endTime,
        moment.hook,
        job.captionStyle || 'bounce',
        subPath
      );

      // Render vertical 9:16 MP4
      await renderVerticalClip({
        sourceVideoPath: rawSectionPath,
        startTime: 0,
        endTime: moment.endTime - moment.startTime,
        subtitlePath: subPath,
        layout: job.frameLayout || 'blurred-fill',
        outputClipPath: clipVideoPath,
      });

      const clip: Clip = {
        id: clipId,
        jobId,
        title: `[Part ${partNumber}] ${moment.title}`,
        hook: moment.hook,
        startTime: moment.startTime,
        endTime: moment.endTime,
        duration: Math.round((moment.endTime - moment.startTime) * 10) / 10,
        score: moment.score,
        style: job.captionStyle || 'bounce',
        layout: job.frameLayout || 'blurred-fill',
        videoPath: clipVideoPath,
        publicUrl: `/api/clips/${clipId}`,
        description: `Extracted from Part ${partNumber} (${partTimeRange}). ${moment.description}`,
        hashtags: moment.hashtags,
        partNumber,
        chunkRange: partTimeRange,
        matchedUserPrompt: moment.matchedUserPrompt,
        createdAt: new Date().toISOString(),
      };

      newClips.push(clip);
      existingClips.push(clip);
      updateJob(jobId, { clips: [...existingClips] });
    } catch (clipErr: any) {
      console.warn(`[Part ${partNumber}] Failed rendering moment ${i + 1} (${moment.hook}):`, clipErr);
      clipErrors.push(clipErr.message || String(clipErr));
    } finally {
      try {
        if (fs.existsSync(rawSectionPath)) fs.unlinkSync(rawSectionPath);
      } catch {}
    }
  }

  // Clean up temporary audio slice
  try {
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  } catch {}

  // If at least one clip was successfully harvested, complete this part!
  if (newClips.length > 0) {
    const completed = Array.from(new Set([...(job.stepper.completedChunks || []), chunkIndex])).sort(
      (a, b) => a - b
    );

    const skippedNotice = clipErrors.length > 0 ? ` (${clipErrors.length} skipped due to network glitch)` : '';

    updateJob(jobId, {
      status: 'completed',
      progress: 100,
      error: undefined,
      statusMessage: `Part ${partNumber}/${totalChunks} ready! Harvested ${newClips.length} clips for [${partTimeRange}]${skippedNotice}.`,
      stepper: {
        ...job.stepper,
        currentChunkIndex: chunkIndex,
        chunkStartTime,
        chunkEndTime,
        completedChunks: completed,
      },
      clips: existingClips,
    });
  } else {
    // If all clips failed for this chunk, mark failed but preserve existing clips and position
    updateJob(jobId, {
      status: 'failed',
      progress: 88,
      statusMessage: `Part ${partNumber} stopped due to network drop. Click "Retry Part ${partNumber}".`,
      error: clipErrors[0] || `Failed to download or render video slices for Part ${partNumber}`,
      stepper: {
        ...job.stepper,
        currentChunkIndex: chunkIndex,
        chunkStartTime,
        chunkEndTime,
      },
      clips: existingClips,
    });
  }
}
