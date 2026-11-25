import { NextRequest, NextResponse } from 'next/server';
import { recordClipFeedback, getLearningMemory } from '@/lib/learning';
import { updateClipFeedback } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const memory = getLearningMemory();
    return NextResponse.json({ success: true, memory });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve learning memory' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clipId,
      jobId,
      type,
      userPrompt,
      clipTitle,
      clipHook,
      reason,
      userNote,
    } = body;

    if (!clipId || !type || (type !== 'like' && type !== 'dislike')) {
      return NextResponse.json(
        { error: 'Valid clipId and type (like or dislike) are required' },
        { status: 400 }
      );
    }

    // 1. Record feedback and adapt system prompt rules
    const { memory, newRule } = recordClipFeedback({
      clipId,
      jobId,
      type,
      userPrompt,
      clipTitle,
      clipHook,
      reason,
      userNote,
    });

    // 2. Persist feedback rating to jobs.json on the clip
    updateClipFeedback(clipId, type, userNote);

    return NextResponse.json({
      success: true,
      message:
        type === 'like'
          ? 'Positive feedback recorded! AI reinforced good context matching.'
          : 'Dislike recorded. AI adapted system prompt rules to prevent this mistake.',
      newRule,
      totalLikes: memory.totalLikes,
      totalDislikes: memory.totalDislikes,
      activeRulesCount: memory.learnedRules.length,
    });
  } catch (err: any) {
    console.error('Error in /api/feedback:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to record feedback' },
      { status: 500 }
    );
  }
}
