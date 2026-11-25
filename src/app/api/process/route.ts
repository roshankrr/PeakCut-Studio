import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { processVideoJob } from '@/lib/orchestrator';
import { CONFIG } from '@/lib/config';
import { CaptionStyle, FrameLayout, TemplateId, LogoOverlay } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      const {
        url,
        captionStyle = 'bounce',
        frameLayout = 'blurred-fill',
        clipCount = 3,
        userPrompt,
        templateId = 'viral-clipper',
        logoOverlay,
      } = body;

      if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
      }

      const job = await processVideoJob({
        sourceUrl: url,
        captionStyle: captionStyle as CaptionStyle,
        frameLayout: frameLayout as FrameLayout,
        targetClipCount: Number(clipCount) || 3,
        userPrompt: typeof userPrompt === 'string' && userPrompt.trim() ? userPrompt.trim() : undefined,
        templateId: templateId as TemplateId,
        logoOverlay: logoOverlay as LogoOverlay | undefined,
      });

      return NextResponse.json({ job });
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const captionStyle = (formData.get('captionStyle') as CaptionStyle) || 'bounce';
      const frameLayout = (formData.get('frameLayout') as FrameLayout) || 'blurred-fill';
      const clipCount = Number(formData.get('clipCount')) || 3;
      const userPrompt = (formData.get('userPrompt') as string) || undefined;
      const templateId = (formData.get('templateId') as TemplateId) || 'viral-clipper';
      const rawLogoOverlay = formData.get('logoOverlay') as string | null;

      let logoOverlay: LogoOverlay | undefined = undefined;
      if (rawLogoOverlay) {
        try {
          logoOverlay = JSON.parse(rawLogoOverlay);
        } catch {}
      }

      // If a raw logo file is uploaded directly in FormData
      const logoFile = formData.get('logoFile') as File | null;
      if (logoFile && logoFile.size > 0) {
        const logoBuf = Buffer.from(await logoFile.arrayBuffer());
        const logoExt = path.extname(logoFile.name) || '.png';
        const logoFileName = `logo_${Date.now()}_${logoFile.name.replace(/[^a-zA-Z0-9\._-]/g, '_')}`;
        const savedLogoPath = path.join(CONFIG.LOGOS_DIR, logoFileName);
        if (!fs.existsSync(CONFIG.LOGOS_DIR)) {
          fs.mkdirSync(CONFIG.LOGOS_DIR, { recursive: true });
        }
        fs.writeFileSync(savedLogoPath, logoBuf);

        logoOverlay = {
          position: (formData.get('logoPosition') as any) || 'bottom-left',
          path: savedLogoPath,
          url: `/api/logos/${logoFileName}`,
          widthPercent: Number(formData.get('logoWidthPercent')) || 18,
          opacity: Number(formData.get('logoOpacity')) || 1.0,
          ...logoOverlay,
        };
      }

      if (!file) {
        return NextResponse.json({ error: 'File is required' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const tempFilename = `upload_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9\._-]/g, '_')}`;
      const savedPath = path.join(CONFIG.VIDEOS_DIR, tempFilename);

      if (!fs.existsSync(CONFIG.VIDEOS_DIR)) {
        fs.mkdirSync(CONFIG.VIDEOS_DIR, { recursive: true });
      }
      fs.writeFileSync(savedPath, buffer);

      const job = await processVideoJob({
        uploadedFilePath: savedPath,
        originalFilename: file.name,
        captionStyle,
        frameLayout,
        targetClipCount: clipCount,
        userPrompt: userPrompt?.trim() || undefined,
        templateId,
        logoOverlay,
      });

      return NextResponse.json({ job });
    }

    return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in /api/process:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
