import { NextRequest, NextResponse } from 'next/server';
import { startStreamStepperJob, advanceStepperChunk } from '@/lib/stepperOrchestrator';
import { CaptionStyle, FrameLayout } from '@/lib/types';
import { getJob } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action = 'start',
      sourceUrl,
      jobId,
      chunkMinutes = 20,
      startChunkIndex = 0,
      targetChunkIndex,
      captionStyle = 'bounce',
      frameLayout = 'blurred-fill',
      clipCount = 3,
      userPrompt,
    } = body;

    if (action === 'start') {
      if (!sourceUrl || typeof sourceUrl !== 'string') {
        return NextResponse.json({ error: 'sourceUrl is required' }, { status: 400 });
      }

      const job = await startStreamStepperJob({
        sourceUrl: sourceUrl.trim(),
        chunkMinutes: Number(chunkMinutes) || 20,
        startChunkIndex: Number(startChunkIndex) || 0,
        captionStyle: captionStyle as CaptionStyle,
        frameLayout: frameLayout as FrameLayout,
        clipCount: Number(clipCount) || 3,
        userPrompt: typeof userPrompt === 'string' ? userPrompt.trim() : undefined,
      });

      return NextResponse.json({ success: true, job });
    } else if (action === 'next') {
      if (!jobId) {
        return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
      }

      const job = await advanceStepperChunk(
        jobId,
        typeof targetChunkIndex === 'number' ? targetChunkIndex : undefined,
        typeof userPrompt === 'string' ? userPrompt.trim() : undefined
      );

      return NextResponse.json({ success: true, job });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('Error in /api/stepper:', err);
    return NextResponse.json(
      { error: err.message || 'Stream stepper processing failed' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, job });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch stepper job' },
      { status: 500 }
    );
  }
}
