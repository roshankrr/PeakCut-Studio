/**
 * POST /api/rerender
 *
 * Professional Clip Re-Rendering Engine
 *
 * Edits any existing clip (Viral, Versus, or Gaming Split):
 *  - Precise Trimming: trimStart / trimEnd
 *  - Framing / Crop: 'blurred-fill' | 'center-crop' | 'fit'
 *  - Draggable & Fully Editable Text Overlays (X/Y coordinates, colors, sizes, no broken emojis)
 *  - Subtitle Typography: Font size scaling (0.5x – 2.0x) + custom MarginV vertical position
 *  - Playback Speed: 1.0x | 1.1x | 1.25x
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { CONFIG } from '@/lib/config';
import { getJob, updateJob } from '@/lib/storage';
import { FrameLayout, TextOverlay, LogoOverlay } from '@/lib/types';
import { stripEmojis, escapeDrawText } from '@/lib/versusRenderer';

export interface RerenderRequestBody {
  clipId: string;
  jobId: string;
  layout?: FrameLayout | 'fit';
  fontSizeMultiplier?: number;
  subtitleYRatio?: number;      // 0.0 (top) to 1.0 (bottom)
  trimStart?: number;           // seconds from beginning
  trimEnd?: number;             // seconds from end
  speed?: number;               // 1.0, 1.1, 1.25
  customHook?: string;
  textOverlays?: TextOverlay[];
  logoOverlay?: LogoOverlay | null;
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(CONFIG.BIN_FFMPEG, args);
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    proc.on('close', (code: number | null) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited code ${code}. Stderr: ${stderr.slice(-600)}`));
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RerenderRequestBody;
    const { clipId, jobId } = body;

    if (!clipId || !jobId) {
      return NextResponse.json({ error: 'clipId and jobId are required' }, { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found in database' }, { status: 404 });
    }

    const clipIndex = job.clips.findIndex((c) => c.id === clipId || clipId.startsWith(c.id));
    if (clipIndex === -1) {
      return NextResponse.json({ error: 'Clip not found in job' }, { status: 404 });
    }

    const clip = job.clips[clipIndex];

    // Locate source video for re-rendering
    let sourceVideo = '';
    if (clip.videoPath && fs.existsSync(clip.videoPath)) {
      sourceVideo = clip.videoPath;
    } else {
      const defaultClipPath = path.join(CONFIG.CLIPS_DIR, `${clip.id}.mp4`);
      if (fs.existsSync(defaultClipPath)) {
        sourceVideo = defaultClipPath;
      } else if (job.videoPath && fs.existsSync(job.videoPath)) {
        sourceVideo = job.videoPath;
      }
    }

    if (!sourceVideo || !fs.existsSync(sourceVideo)) {
      return NextResponse.json(
        { error: `Could not locate video file on disk for clip ${clip.id}.` },
        { status: 404 }
      );
    }

    // Parameters
    const trimStart = Math.max(0, Number(body.trimStart) || 0);
    const trimEnd = Math.max(0, Number(body.trimEnd) || 0);
    const speed = [1.0, 1.1, 1.25].includes(Number(body.speed)) ? Number(body.speed) : 1.0;
    const fontMultiplier = Math.min(2.5, Math.max(0.5, Number(body.fontSizeMultiplier) || 1.0));
    const subtitleY = typeof body.subtitleYRatio === 'number' ? body.subtitleYRatio : 0.8;
    const layout = body.layout || clip.layout || 'blurred-fill';
    const textOverlays = body.textOverlays;

    const currentDuration = clip.duration || 30;
    const effectiveDuration = Math.max(3, currentDuration - trimStart - trimEnd);

    // Prepare Subtitle handling
    const originalSubPath = path.join(CONFIG.SUBS_DIR, `${clip.id}.ass`);
    const editSubPath = path.join(CONFIG.SUBS_DIR, `${clip.id}_edit.ass`);
    let subtitleToBurn: string | null = null;

    if (fs.existsSync(originalSubPath)) {
      let assContent = fs.readFileSync(originalSubPath, 'utf-8');

      // Scale font sizes
      if (fontMultiplier !== 1.0) {
        assContent = assContent.replace(/Fontsize:\s*(\d+)/g, (_m, sz) => {
          return `Fontsize: ${Math.round(Number(sz) * fontMultiplier)}`;
        });
        assContent = assContent.replace(/\{\\fs(\d+)\}/g, (_m, sz) => {
          return `{\\fs${Math.round(Number(sz) * fontMultiplier)}}`;
        });
      }

      // Vertical position (MarginV)
      const marginV = Math.round((1.0 - subtitleY) * 900);
      assContent = assContent.replace(/MarginV:\s*\d+/g, `MarginV: ${marginV}`);

      fs.writeFileSync(editSubPath, assContent, 'utf-8');
      subtitleToBurn = editSubPath;
    }

    // Build FFmpeg Complex Filter
    const vFilters: string[] = [];

    // Framing / Crop
    if (layout === 'center-crop') {
      vFilters.push(`scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];[0:v]crop=min(iw\\,ih*13/16):ih:(iw-ow)/2:0,scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`);
    } else if (layout === 'fit') {
      vFilters.push(`scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black`);
    } else {
      vFilters.push(`scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`);
    }

    // Speed adjustment
    if (speed !== 1.0) {
      const ptsFactor = (1 / speed).toFixed(4);
      vFilters.push(`setpts=${ptsFactor}*PTS`);
    }

    // Burn subtitles if available
    if (subtitleToBurn && fs.existsSync(subtitleToBurn)) {
      const escapedPath = subtitleToBurn.replace(/\\/g, '/').replace(/:/g, '\\:');
      vFilters.push(`subtitles=${escapedPath}`);
    }

    // Draggable / Editable Text Overlays (Positioned anywhere on 9:16 frame)
    if (Array.isArray(textOverlays) && textOverlays.length > 0) {
      for (const ov of textOverlays) {
        const cleanText = escapeDrawText(ov.text);
        if (!cleanText) continue;

        // Proportional X and Y centered around coordinates
        const xClamped = Math.max(5, Math.min(95, ov.xPercent));
        const yClamped = Math.max(3, Math.min(97, ov.yPercent));
        const xExpr = `(w*${(xClamped / 100).toFixed(3)}-tw/2)`;
        const yExpr = `(h*${(yClamped / 100).toFixed(3)}-th/2)`;

        const fontSize = ov.fontSize || 38;
        const fontColor = ov.fontColor || 'white';
        let boxClause = '';
        if (ov.bgColor && ov.bgColor !== 'none') {
          boxClause = `:box=1:boxcolor=${ov.bgColor}:boxborderw=8`;
        } else {
          boxClause = ':shadowcolor=black@0.9:shadowx=3:shadowy=3';
        }

        vFilters.push(
          `drawtext=text='${cleanText}':x=${xExpr}:y=${yExpr}:fontsize=${fontSize}:fontcolor=${fontColor}${boxClause}`
        );
      }
    } else if (body.customHook) {
      const escHook = escapeDrawText(body.customHook);
      if (escHook) {
        vFilters.push(
          `drawtext=text='${escHook}':x=(w-tw)/2:y=80:fontsize=44:fontcolor=yellow:box=1:boxcolor=black@0.8:boxborderw=14`
        );
      }
    }

    const finalFilterString = vFilters.join(',');

    // Logo Overlay handling
    const logoOverlay = body.logoOverlay !== undefined ? body.logoOverlay : clip.logoOverlay;
    const hasLogo = Boolean(logoOverlay?.path && fs.existsSync(logoOverlay.path));

    // Audio filter for speed
    const aFilters: string[] = [];
    if (speed !== 1.0) {
      aFilters.push(`atempo=${speed}`);
    }

    const outputClipName = `${clip.id}_v${Date.now().toString().slice(-4)}`;
    const outputPath = path.join(CONFIG.CLIPS_DIR, `${outputClipName}.mp4`);

    const ffmpegArgs: string[] = ['-y'];

    // Seek / Trim
    if (trimStart > 0) {
      ffmpegArgs.push('-ss', trimStart.toFixed(2));
    }

    ffmpegArgs.push('-i', sourceVideo);

    if (hasLogo && logoOverlay?.path) {
      ffmpegArgs.push('-i', logoOverlay.path);
    }

    if (effectiveDuration > 0) {
      ffmpegArgs.push('-t', effectiveDuration.toFixed(2));
    }

    if (hasLogo && logoOverlay?.path) {
      const widthPct = logoOverlay.widthPercent || 18;
      const targetWidth = Math.max(60, Math.min(480, Math.round(1080 * (widthPct / 100))));
      const opacity = typeof logoOverlay.opacity === 'number'
        ? Math.max(0.1, Math.min(1.0, logoOverlay.opacity))
        : 1.0;

      let overlayExpr = '50:H-h-110';
      const pos = logoOverlay.position || 'bottom-left';

      if (pos === 'bottom-left') {
        overlayExpr = '50:H-h-110';
      } else if (pos === 'bottom-right') {
        overlayExpr = 'W-w-50:H-h-110';
      } else if (pos === 'top-left') {
        overlayExpr = '50:90';
      } else if (pos === 'top-right') {
        overlayExpr = 'W-w-50:90';
      } else if (pos === 'top-center') {
        overlayExpr = '(W-w)/2:90';
      } else if (pos === 'bottom-center') {
        overlayExpr = '(W-w)/2:H-h-110';
      } else if (pos === 'center') {
        overlayExpr = '(W-w)/2:(H-h)/2';
      } else if (pos === 'custom' && logoOverlay.xPercent !== undefined && logoOverlay.yPercent !== undefined) {
        const xClamped = Math.max(2, Math.min(95, logoOverlay.xPercent));
        const yClamped = Math.max(2, Math.min(95, logoOverlay.yPercent));
        overlayExpr = `(W-w)*${(xClamped / 100).toFixed(3)}:(H-h)*${(yClamped / 100).toFixed(3)}`;
      }

      const complexFilter = [
        `[0:v]${finalFilterString}[v_base]`,
        `[1:v]scale=${targetWidth}:-1:flags=lanczos,format=rgba,colorchannelmixer=aa=${opacity}[logo_scaled]`,
        `[v_base][logo_scaled]overlay=${overlayExpr}:eof_action=repeat[v_out]`,
      ].join(';');

      ffmpegArgs.push('-filter_complex', complexFilter, '-map', '[v_out]', '-map', '0:a?');
    } else if (finalFilterString) {
      ffmpegArgs.push('-vf', finalFilterString);
    }

    if (aFilters.length > 0) {
      ffmpegArgs.push('-af', aFilters.join(','));
    }

    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath
    );

    console.log(`[Rerender] Executing FFmpeg edit for ${clip.id}...`);
    await runFFmpeg(ffmpegArgs);

    // Update clip in job
    const newPublicUrl = `/api/clips/${outputClipName}`;
    const updatedClip = {
      ...clip,
      duration: Math.round((effectiveDuration / speed) * 10) / 10,
      videoPath: outputPath,
      publicUrl: newPublicUrl,
      hook: textOverlays?.find((o) => o.id === 'hook' || o.id === 'topLabel')?.text || body.customHook || clip.hook,
      layout: layout as FrameLayout,
      overlays: textOverlays || clip.overlays,
      logoOverlay: hasLogo && logoOverlay ? logoOverlay : (body.logoOverlay === null ? undefined : clip.logoOverlay),
    };

    job.clips[clipIndex] = updatedClip;
    updateJob(jobId, { clips: [...job.clips] });

    return NextResponse.json({
      success: true,
      clip: updatedClip,
      publicUrl: newPublicUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/rerender] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
