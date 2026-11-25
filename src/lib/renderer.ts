import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { CONFIG } from './config';
import { FrameLayout, LogoOverlay } from './types';

export interface RenderClipOptions {
  sourceVideoPath: string;
  startTime: number;
  endTime: number;
  subtitlePath?: string;
  layout: FrameLayout;
  outputClipPath: string;
  logoOverlay?: LogoOverlay;
}

export async function renderVerticalClip({
  sourceVideoPath,
  startTime,
  endTime,
  subtitlePath,
  layout,
  outputClipPath,
  logoOverlay,
}: RenderClipOptions): Promise<string> {
  const duration = Math.max(1, endTime - startTime);

  // Construct FFmpeg complex filter for 9:16 vertical layout
  let filterString = '';

  if (layout === 'blurred-fill') {
    // Background: scale and crop to 1080x1920 with strong blur
    // Foreground: scale width to 1080 preserving aspect ratio
    // Overlay foreground centered onto blurred background
    filterString = [
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg]`,
      `[0:v]scale=1080:-2[fg]`,
      `[bg][fg]overlay=(W-w)/2:(H-h)/2[base]`,
    ].join(';');
  } else if (layout === 'center-crop') {
    // Wide 9:13 / 9:14 Action View: preserves 75%+ of horizontal field so gameplay HUD/action is visible
    filterString = [
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg]`,
      `[0:v]crop=min(iw\\,ih*13/16):ih:(iw-ow)/2:0,scale=1080:-2[fg]`,
      `[bg][fg]overlay=(W-w)/2:(H-h)/2[base]`,
    ].join(';');
  } else {
    // Default blurred-fill
    filterString = [
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg]`,
      `[0:v]scale=1080:-2[fg]`,
      `[bg][fg]overlay=(W-w)/2:(H-h)/2[base]`,
    ].join(';');
  }

  const hasLogo = Boolean(
    logoOverlay?.path && fs.existsSync(logoOverlay.path)
  );

  // If subtitles are provided, burn them onto the [base] layer
  let intermediateFilter = '[base]';
  if (subtitlePath && fs.existsSync(subtitlePath)) {
    // Escape path for ffmpeg filter: escape colons and backslashes
    const escapedSubPath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
    filterString += `;[base]subtitles=${escapedSubPath}[v_subbed]`;
    intermediateFilter = '[v_subbed]';
  }

  // If logo overlay is provided, scale & overlay onto video
  if (hasLogo && logoOverlay?.path) {
    const widthPct = logoOverlay.widthPercent || 18;
    const targetWidth = Math.max(60, Math.min(480, Math.round(1080 * (widthPct / 100))));
    const opacity = typeof logoOverlay.opacity === 'number'
      ? Math.max(0.1, Math.min(1.0, logoOverlay.opacity))
      : 1.0;

    filterString += `;[1:v]scale=${targetWidth}:-1:flags=lanczos,format=rgba,colorchannelmixer=aa=${opacity}[logo_scaled]`;

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

    filterString += `;${intermediateFilter}[logo_scaled]overlay=${overlayExpr}:eof_action=repeat[v]`;
  } else {
    filterString += intermediateFilter === '[v_subbed]' ? `;[v_subbed]null[v]` : `;[base]null[v]`;
  }

  const args = [
    '-y',
    '-ss',
    startTime.toFixed(2),
    '-t',
    duration.toFixed(2),
    '-i',
    sourceVideoPath,
  ];

  if (hasLogo && logoOverlay?.path) {
    args.push('-i', logoOverlay.path);
  }

  args.push(
    '-t',
    duration.toFixed(2),
    '-filter_complex',
    filterString,
    '-map',
    '[v]',
    '-map',
    '0:a?',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '22',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outputClipPath
  );

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(CONFIG.BIN_FFMPEG, args);
    let stderr = '';

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputClipPath)) {
        resolve();
      } else {
        reject(
          new Error(
            `FFmpeg render failed with exit code ${code}. Stderr: ${stderr.slice(-500)}`
          )
        );
      }
    });
  });

  return outputClipPath;
}
