import { NextRequest, NextResponse } from 'next/server';
import { connectWithDirectToken } from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token || body.accessToken;

    if (!token) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    const tokens = await connectWithDirectToken(token);

    return NextResponse.json({
      success: true,
      username: tokens.igUsername,
      pageName: tokens.pageName,
      avatar: tokens.igProfilePicture,
    });
  } catch (err: any) {
    console.error('Failed to connect with direct Instagram token:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to connect Instagram account with this token' },
      { status: 400 }
    );
  }
}
