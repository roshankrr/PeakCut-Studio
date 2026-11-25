import path from 'path';
import fs from 'fs';
import { CONFIG } from './config';
import { Job, Clip, CaptionStyle, FrameLayout, TemplateId, LogoOverlay } from './types';
import { saveJob, updateJob, initStorage, getJob } from './storage';
import { getVideoMetadata, downloadAudioOnly, downloadVideoSection, tryFetchYouTubeSubtitles } from './downloader';
import { extractAudio, analyzeAudioEnergy } from './audio';
import { transcribeAudio } from './transcriber';
import { findPeakMoments } from './judge';
import { generateAssSubtitles } from './subtitles';
import { renderVerticalClip } from './renderer';

export interface StartJobParams {
  sourceUrl?: string;
  uploadedFilePath?: string;
  originalFilename?: string;
  captionStyle: CaptionStyle;
  frameLayout: FrameLayout;
  targetClipCount?: number;
  userPrompt?: string;
  templateId?: TemplateId;
  logoOverlay?: LogoOverlay;
}

export async function processVideoJob(params: StartJobParams): Promise<Job> {
  initStorage();

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const initialJob: Job = {
    id: jobId,
    sourceUrl: params.sourceUrl,
    inputFilename: params.originalFilename,
    templateId: params.templateId || 'viral-clipper',
    logoOverlay: params.logoOverlay,
    status: 'pending',
    progress: 5,
    statusMessage: params.userPrompt?.trim()
      ? `Initializing pipeline (focusing on: "${params.userPrompt.trim().slice(0, 35)}")...`
      : 'Initializing pipeline...',
    captionStyle: params.captionStyle,
    frameLayout: params.frameLayout,
    userPrompt: params.userPrompt?.trim() || undefined,
    clips: [],
    createdAt: new Date().toISOString(),
  };

  saveJob(initialJob);

  runPipeline(jobId, params).catch((err) => {
    console.error(`Pipeline failed for job ${jobId}:`, err);
    updateJob(jobId, {
      status: 'failed',
      statusMessage: 'Job failed',
      error: err.message,
    });
  });

  return initialJob;
}

async function runPipeline(jobId: string, params: StartJobParams) {
  let audioPath = '';
  let videoTitle = params.originalFilename || 'Stream Video';
  let totalDuration = 0;
  let heatmapData: any = undefined;

  // STEP 1 & 2: Ingestion & Audio Preparation
  if (params.sourceUrl) {
    updateJob(jobId, {
      status: 'downloading',
      progress: 10,
      statusMessage: 'Checking stream metadata & audience replay heatmap...',
    });

    const meta = await getVideoMetadata(params.sourceUrl);
    videoTitle = meta.title;
    totalDuration = meta.duration;
    heatmapData = meta.heatmap;

    updateJob(jobId, {
      title: videoTitle,
      duration: totalDuration,
      hasHeatmap: Boolean(meta.heatmap && meta.heatmap.length > 0),
      progress: 20,
      statusMessage: meta.heatmap && meta.heatmap.length > 0
        ? `Found ${meta.heatmap.length} audience engagement heatmap peaks! Downloading audio stream...`
        : 'Downloading fast audio stream (~20MB audio-first mode)...',
    });

    // Fast Audio-First Ingestion (only downloads ~20-30MB instead of 5GB video!)
    audioPath = await downloadAudioOnly(params.sourceUrl, jobId, (prog, msg) => {
      updateJob(jobId, { progress: prog, statusMessage: msg });
    });
  } else if (params.uploadedFilePath) {
    videoTitle = params.originalFilename || 'Uploaded Video';
    updateJob(jobId, {
      status: 'extracting_audio',
      progress: 25,
      statusMessage: 'Extracting audio track from uploaded file...',
    });

    const extracted = await extractAudio(params.uploadedFilePath, jobId);
    audioPath = extracted.audioPath;
  } else {
    throw new Error('Neither source URL nor uploaded file was provided.');
  }

  updateJob(jobId, {
    audioPath,
    title: videoTitle,
    status: 'transcribing',
    progress: 40,
    statusMessage: 'Checking for native captions & analyzing audio energy...',
  });

  // STEP 3: Subtitles / Transcription + Audio Energy Analysis
  let nativeSegments: any[] | null = null;
  if (params.sourceUrl) {
    try {
      nativeSegments = await tryFetchYouTubeSubtitles(params.sourceUrl, jobId);
      if (nativeSegments && nativeSegments.length > 0) {
        updateJob(jobId, {
          progress: 50,
          statusMessage: `Found ${nativeSegments.length} native YouTube captions! Skipping Whisper API...`,
        });
      }
    } catch {}
  }

  const energyPointsPromise = analyzeAudioEnergy(audioPath);

  const transcriptPromise = nativeSegments && nativeSegments.length > 0
    ? Promise.resolve({
        text: nativeSegments.map((s) => s.text).join(' '),
        segments: nativeSegments,
        duration: totalDuration,
      })
    : transcribeAudio(audioPath, (msg) => {
        updateJob(jobId, { statusMessage: msg });
      });

  const [energyPoints, transcriptResult] = await Promise.all([
    energyPointsPromise,
    transcriptPromise,
  ]);

  if (!totalDuration) {
    totalDuration = transcriptResult.duration;
  }

  // Cache transcript & energy on disk for instant "Get More Clips" without re-transcribing
  try {
    const transcriptCachePath = path.join(CONFIG.TRANSCRIPTS_DIR, `${jobId}.json`);
    fs.writeFileSync(
      transcriptCachePath,
      JSON.stringify({
        transcript: transcriptResult,
        energyPoints,
        heatmapData,
        totalDuration,
        videoTitle,
        sourceUrl: params.sourceUrl,
        uploadedFilePath: params.uploadedFilePath,
        captionStyle: params.captionStyle,
        frameLayout: params.frameLayout,
        userPrompt: params.userPrompt?.trim() || undefined,
      }),
      'utf-8'
    );
  } catch (cacheErr) {
    console.warn('Failed to cache transcript to disk:', cacheErr);
  }

  // STEP 4: Dual/Triple AI Judges (Heatmap + Words + Audio Reaction)
  updateJob(jobId, {
    status: 'scoring',
    progress: 60,
    statusMessage: params.userPrompt?.trim()
      ? `Scanning transcript for topic: "${params.userPrompt.trim().slice(0, 35)}" & scoring viral hooks...`
      : heatmapData && heatmapData.length > 0
      ? 'Triple AI Judges analyzing audience heatmap + words + hype reactions...'
      : 'Dual AI Judges finding peak viral moments and writing hooks...',
  });

  const targetCount = params.targetClipCount || 3;
  const moments = await findPeakMoments(
    transcriptResult.segments,
    energyPoints,
    totalDuration,
    heatmapData,
    targetCount,
    [],
    false,
    params.userPrompt?.trim()
  );

  // STEP 5: Surgical Video Slicing & Vertical 9:16 Subtitle Rendering
  updateJob(jobId, {
    status: 'rendering',
    progress: 75,
    statusMessage: `Slicing & rendering ${moments.length} vertical 9:16 clips with animated captions...`,
  });

  const generatedClips: Clip[] = [];

  for (let i = 0; i < moments.length; i++) {
    const moment = moments[i];
    const clipId = `${jobId}_clip_${i + 1}`;
    const subPath = path.join(CONFIG.SUBS_DIR, `${clipId}.ass`);
    const clipVideoPath = path.join(CONFIG.CLIPS_DIR, `${clipId}.mp4`);

    updateJob(jobId, {
      progress: Math.min(95, 75 + Math.round(((i + 1) / moments.length) * 20)),
      statusMessage: `Slicing & rendering Clip ${i + 1}/${moments.length}: "${moment.hook}" (${moment.score}/100)...`,
    });

    let sourceForRender = '';

    if (params.sourceUrl) {
      // Surgical Range Slicing: Download ONLY this 30-40s video section directly!
      const rawSectionPath = path.join(CONFIG.VIDEOS_DIR, `${clipId}_raw.mp4`);
      await downloadVideoSection(params.sourceUrl, moment.startTime, moment.endTime, rawSectionPath);
      sourceForRender = rawSectionPath;
    } else if (params.uploadedFilePath) {
      sourceForRender = params.uploadedFilePath;
    }

    // Generate ASS karaoke subtitles with word-level highlight
    generateAssSubtitles(
      transcriptResult.segments,
      moment.startTime,
      moment.endTime,
      moment.hook,
      params.captionStyle,
      subPath
    );

    // Render vertical 9:16 MP4 with burned subtitles and optional logo watermark
    await renderVerticalClip({
      sourceVideoPath: sourceForRender,
      startTime: params.sourceUrl ? 0 : moment.startTime,
      endTime: params.sourceUrl ? (moment.endTime - moment.startTime) : moment.endTime,
      subtitlePath: subPath,
      layout: params.frameLayout,
      outputClipPath: clipVideoPath,
      logoOverlay: params.logoOverlay,
    });

    const clip: Clip = {
      id: clipId,
      jobId,
      title: moment.title,
      hook: moment.hook,
      startTime: moment.startTime,
      endTime: moment.endTime,
      duration: Math.round((moment.endTime - moment.startTime) * 10) / 10,
      score: moment.score,
      style: params.captionStyle,
      layout: params.frameLayout,
      videoPath: clipVideoPath,
      publicUrl: `/api/clips/${clipId}`,
      description: moment.description,
      hashtags: moment.hashtags,
      matchedUserPrompt: moment.matchedUserPrompt,
      logoOverlay: params.logoOverlay,
      createdAt: new Date().toISOString(),
    };

    generatedClips.push(clip);

    updateJob(jobId, {
      clips: [...generatedClips],
    });

    // Clean up temporary surgical slice if it was downloaded
    if (params.sourceUrl && fs.existsSync(sourceForRender)) {
      try {
        fs.unlinkSync(sourceForRender);
      } catch {}
    }
  }

  updateJob(jobId, {
    status: 'completed',
    progress: 100,
    statusMessage: `Ready! Generated ${generatedClips.length} viral clips (Audience & AI scored).`,
    clips: generatedClips,
  });
}

/**
 * Discover & generate additional clips from previously unprocessed/secondary scenes of the video
 */
export async function generateMoreClips(jobId: string, count: number = 3): Promise<Job> {
  initStorage();
  const job = getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  const cachePath = path.join(CONFIG.TRANSCRIPTS_DIR, `${jobId}.json`);
  let cachedData: any = null;

  if (fs.existsSync(cachePath)) {
    try {
      cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    } catch (e) {
      console.warn('Failed reading transcript cache:', e);
    }
  }

  // If cache is missing, reconstruct from subtitles/audio
  if (!cachedData) {
    let nativeSegments: any[] | null = null;
    if (job.sourceUrl) {
      try {
        nativeSegments = await tryFetchYouTubeSubtitles(job.sourceUrl, jobId);
      } catch {}
    }

    if (!job.audioPath && job.sourceUrl) {
      job.audioPath = await downloadAudioOnly(job.sourceUrl, jobId);
    }

    const energyPoints = job.audioPath ? await analyzeAudioEnergy(job.audioPath) : [];
    const transcriptResult = nativeSegments && nativeSegments.length > 0
      ? { text: nativeSegments.map((s) => s.text).join(' '), segments: nativeSegments, duration: job.duration || 600 }
      : job.audioPath
      ? await transcribeAudio(job.audioPath)
      : null;

    if (!transcriptResult) {
      throw new Error('Cannot find audio or transcript for this job to extract more clips.');
    }

    cachedData = {
      transcript: transcriptResult,
      energyPoints,
      heatmapData: undefined,
      totalDuration: job.duration || transcriptResult.duration,
      sourceUrl: job.sourceUrl,
      captionStyle: job.captionStyle,
      frameLayout: job.frameLayout,
    };

    fs.writeFileSync(cachePath, JSON.stringify(cachedData), 'utf-8');
  }

  const excludeRanges = (job.clips || []).map((c) => ({
    startTime: c.startTime,
    endTime: c.endTime,
  }));

  updateJob(jobId, {
    status: 'scoring',
    statusMessage: `Scanning stream for ${count} more engaging moments (conversational & secondary virality)...`,
  });

  const moments = await findPeakMoments(
    cachedData.transcript.segments,
    cachedData.energyPoints || [],
    cachedData.totalDuration,
    cachedData.heatmapData,
    count,
    excludeRanges,
    true, // includeSecondaryScores
    job.userPrompt || cachedData.userPrompt
  );

  if (moments.length === 0) {
    updateJob(jobId, {
      status: 'completed',
      statusMessage: 'No more distinct non-overlapping scenes found in this stream.',
    });
    return getJob(jobId)!;
  }

  updateJob(jobId, {
    status: 'rendering',
    statusMessage: `Slicing & rendering ${moments.length} additional vertical clips...`,
  });

  const existingClips = [...(job.clips || [])];
  const newClips: Clip[] = [];
  const startIndex = existingClips.length;

  for (let i = 0; i < moments.length; i++) {
    const moment = moments[i];
    const clipId = `${jobId}_clip_${startIndex + i + 1}`;
    const subPath = path.join(CONFIG.SUBS_DIR, `${clipId}.ass`);
    const clipVideoPath = path.join(CONFIG.CLIPS_DIR, `${clipId}.mp4`);

    updateJob(jobId, {
      statusMessage: `Rendering Clip ${startIndex + i + 1}: "${moment.hook}" (${moment.score}/100)...`,
    });

    let sourceForRender = '';
    if (job.sourceUrl) {
      const rawSectionPath = path.join(CONFIG.VIDEOS_DIR, `${clipId}_raw.mp4`);
      await downloadVideoSection(job.sourceUrl, moment.startTime, moment.endTime, rawSectionPath);
      sourceForRender = rawSectionPath;
    } else if (job.videoPath) {
      sourceForRender = job.videoPath;
    }

    generateAssSubtitles(
      cachedData.transcript.segments,
      moment.startTime,
      moment.endTime,
      moment.hook,
      job.captionStyle || 'bounce',
      subPath
    );

    await renderVerticalClip({
      sourceVideoPath: sourceForRender,
      startTime: job.sourceUrl ? 0 : moment.startTime,
      endTime: job.sourceUrl ? (moment.endTime - moment.startTime) : moment.endTime,
      subtitlePath: subPath,
      layout: job.frameLayout || 'blurred-fill',
      outputClipPath: clipVideoPath,
      logoOverlay: job.logoOverlay,
    });

    const newClip: Clip = {
      id: clipId,
      jobId,
      title: moment.title,
      hook: moment.hook,
      startTime: moment.startTime,
      endTime: moment.endTime,
      duration: Math.round((moment.endTime - moment.startTime) * 10) / 10,
      score: moment.score,
      style: job.captionStyle || 'bounce',
      layout: job.frameLayout || 'blurred-fill',
      videoPath: clipVideoPath,
      publicUrl: `/api/clips/${clipId}`,
      description: moment.description,
      hashtags: moment.hashtags,
      matchedUserPrompt: moment.matchedUserPrompt,
      logoOverlay: job.logoOverlay,
      createdAt: new Date().toISOString(),
    };

    newClips.push(newClip);
    existingClips.push(newClip);
    updateJob(jobId, { clips: [...existingClips] });

    if (job.sourceUrl && fs.existsSync(sourceForRender)) {
      try {
        fs.unlinkSync(sourceForRender);
      } catch {}
    }
  }

  updateJob(jobId, {
    status: 'completed',
    statusMessage: `Ready! Now have ${existingClips.length} clips (+${newClips.length} newly discovered moments).`,
    clips: existingClips,
  });

  return getJob(jobId)!;
}
