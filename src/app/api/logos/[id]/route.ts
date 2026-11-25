import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const fileName = path.basename(params.id);
  const filePath = path.join(CONFIG.LOGOS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
  }

  const ext = path.extname(fileName).toLowerCase();
  let contentType = 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.svg') contentType = 'image/svg+xml';
  else if (ext === '.gif') contentType = 'image/gif';

  const fileBuffer = fs.readFileSync(filePath);
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
