import { NextRequest, NextResponse } from 'next/server';
import { generateMoreClips } from '@/lib/orchestrator';
import { getJob } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, count = 3 } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Run in background and return job immediately so UI updates progress via status polling
    generateMoreClips(jobId, count).catch((err) => {
      console.error(`Failed to generate more clips for ${jobId}:`, err);
    });

    return NextResponse.json({
      success: true,
      message: `Generating ${count} additional clips...`,
      job: getJob(jobId),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
