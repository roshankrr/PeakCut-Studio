import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '@/lib/config';
import { initStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    initStorage();
    const contentType = req.headers.get('content-type') || '';

    let fileName = `logo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.png`;
    let fileBuffer: Buffer | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = (formData.get('file') || formData.get('logo')) as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No logo file provided' }, { status: 400 });
      }

      const ext = path.extname(file.name) || '.png';
      const cleanBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      fileName = `logo_${Date.now()}_${cleanBase}${ext}`;
      fileBuffer = Buffer.from(await file.arrayBuffer());
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      const { dataUrl, base64, name } = body;

      if (dataUrl && typeof dataUrl === 'string') {
        const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches[2]) {
          fileBuffer = Buffer.from(matches[2], 'base64');
          const mime = matches[1];
          const ext = mime.includes('jpeg') || mime.includes('jpg') ? '.jpg' : mime.includes('svg') ? '.svg' : '.png';
          fileName = `logo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
        }
      } else if (base64 && typeof base64 === 'string') {
        fileBuffer = Buffer.from(base64, 'base64');
        fileName = name ? `logo_${Date.now()}_${name}` : fileName;
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ error: 'Failed to read logo image data' }, { status: 400 });
    }

    const savedPath = path.join(CONFIG.LOGOS_DIR, fileName);
    fs.writeFileSync(savedPath, fileBuffer);

    return NextResponse.json({
      success: true,
      logoId: fileName,
      logoPath: savedPath,
      logoUrl: `/api/logos/${fileName}`,
      fileName,
    });
  } catch (err: unknown) {
    console.error('Error in /api/upload-logo:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Logo upload failed' },
      { status: 500 }
    );
  }
}
