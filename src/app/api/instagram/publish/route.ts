import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '@/lib/config';
import { getJob } from '@/lib/storage';
import { publishReelToInstagram } from '@/lib/instagram';
import { Clip } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clipId, jobId, caption, shareToFeed } = body;

    if (!clipId) {
      return NextResponse.json({ error: 'Missing clipId' }, { status: 400 });
    }

    // Locate the video file on disk
    let videoPath: string | null = null;

    // Check direct CLIPS_DIR
    const directPath = path.join(CONFIG.CLIPS_DIR, `${clipId}.mp4`);
    if (fs.existsSync(directPath)) {
      videoPath = directPath;
    }

    // Check inside jobs.json if not found
    if (!videoPath && jobId) {
      const job = getJob(jobId);
      const clip = job?.clips?.find((c: Clip) => c.id === clipId);
      if (clip && clip.videoPath && fs.existsSync(clip.videoPath)) {
        videoPath = clip.videoPath;
      }
    }

    if (!videoPath || !fs.existsSync(videoPath)) {
      return NextResponse.json(
        { error: `Rendered clip MP4 file not found on disk for ${clipId}` },
        { status: 404 }
      );
    }

    const result = await publishReelToInstagram({
      videoPath,
      caption: caption || '',
      shareToFeed: shareToFeed ?? true,
    });

    return NextResponse.json({
      success: true,
      mediaId: result.mediaId,
      permalink: result.permalink,
    });
  } catch (err: any) {
    console.error('Failed to publish Reel to Instagram:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to publish Reel to Instagram' },
      { status: 500 }
    );
  }
}
