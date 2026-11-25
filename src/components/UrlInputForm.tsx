'use client';

import React, { useState } from 'react';
import {
  Link2,
  Upload,
  Wand2,
  Youtube,
  PlaySquare,
  Swords,
  Timer,
  MessageSquare,
  Gamepad2,
  Loader2,
  AlertTriangle,
  Clock,
  Sparkles,
  FastForward,
  Award,
  Image as ImageIcon,
  Sliders,
  Check,
  X,
  Layers,
  Move,
} from 'lucide-react';
import { CaptionStyle, FrameLayout, TemplateId, Job, LogoOverlay, LogoPosition } from '@/lib/types';

interface UrlInputFormProps {
  onSubmitUrl: (url: string, style: CaptionStyle, layout: FrameLayout, clipCount?: number, userPrompt?: string) => void;
  onSubmitFile: (file: File, style: CaptionStyle, layout: FrameLayout, clipCount?: number, userPrompt?: string) => void;
  onJobCreated?: (job: Job) => void;
  disabled?: boolean;
  templateId?: TemplateId;
}

// ─── Versus Studio Form ───────────────────────────────────────────────────────

function VersusForm({
  disabled,
  onJobCreated,
}: {
  disabled?: boolean;
  onJobCreated?: (job: Job) => void;
}) {
  const [clipAUrl, setClipAUrl] = useState('');
  const [clipALabel, setClipALabel] = useState('Old Version');
  const [clipAStartTime, setClipAStartTime] = useState('');
  const [clipBUrl, setClipBUrl] = useState('');
  const [clipBLabel, setClipBLabel] = useState('New Version');
  const [clipBStartTime, setClipBStartTime] = useState('');
  const [interval, setIntervalVal] = useState(8);
  const [cta, setCta] = useState('Which one wins? Comment below');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clipAUrl.trim() || !clipBUrl.trim()) return;
    setLoading(true);
    setError('');
    setStatusMsg('Scanning heatmaps and aligning peak moments...');

    try {
      const payload: Record<string, unknown> = {
        clipAUrl: clipAUrl.trim(),
        clipBUrl: clipBUrl.trim(),
        clipALabel: clipALabel || 'Old Version',
        clipBLabel: clipBLabel || 'New Version',
        interval,
        cta,
      };

      if (clipAStartTime.trim()) {
        payload.clipAStartTime = Number(clipAStartTime);
      }
      if (clipBStartTime.trim()) {
        payload.clipBStartTime = Number(clipBStartTime);
      }

      setStatusMsg('Downloading surgical sections and rendering alternating video...');

      const res = await fetch('/api/versus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to render versus clip');

      if (data.job && onJobCreated) {
        onJobCreated(data.job);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  }

  return (
    <div className="bg-[#0E1118] border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-brand/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-brand">
          <Swords className="w-5 h-5 stroke-[2]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold text-base tracking-tight">Versus Studio</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/[0.06] text-stone-300 border border-white/[0.08]">
              Dual Feed
            </span>
          </div>
          <p className="text-stone-400 text-xs mt-0.5">
            Stack two videos vertically. One plays in full motion while the other pauses in subdued focus.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Video A */}
        <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
              Top Video (Video A)
            </span>
            <span className="text-[11px] text-stone-400 font-mono">Stage 1</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <input
                type="url"
                value={clipAUrl}
                onChange={(e) => setClipAUrl(e.target.value)}
                placeholder="YouTube URL for Video A"
                required
                disabled={disabled || loading}
                className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-lg px-3.5 py-2.5 text-white placeholder-stone-500 text-xs transition-colors"
              />
            </div>
            <div className="sm:col-span-4">
              <input
                type="text"
                value={clipALabel}
                onChange={(e) => setClipALabel(e.target.value)}
                placeholder="Label (e.g. Old Version)"
                disabled={disabled || loading}
                className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-lg px-3.5 py-2.5 text-white placeholder-stone-500 text-xs transition-colors"
              />
            </div>
            <div className="sm:col-span-12">
              <input
                type="number"
                value={clipAStartTime}
                onChange={(e) => setClipAStartTime(e.target.value)}
                placeholder="Start second (leave blank for heatmap auto-peak)"
                disabled={disabled || loading}
                className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-lg px-3.5 py-2 text-white placeholder-stone-500 text-xs transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Video B */}
        <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
              Bottom Video (Video B)
            </span>
            <span className="text-[11px] text-stone-400 font-mono">Stage 2</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <input
                type="url"
                value={clipBUrl}
                onChange={(e) => setClipBUrl(e.target.value)}
                placeholder="YouTube URL for Video B"
                required
                disabled={disabled || loading}
                className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-lg px-3.5 py-2.5 text-white placeholder-stone-500 text-xs transition-colors"
              />
            </div>
            <div className="sm:col-span-4">
              <input
                type="text"
                value={clipBLabel}
                onChange={(e) => setClipBLabel(e.target.value)}
                placeholder="Label (e.g. New Version)"
                disabled={disabled || loading}
                className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-lg px-3.5 py-2.5 text-white placeholder-stone-500 text-xs transition-colors"
              />
            </div>
            <div className="sm:col-span-12">
              <input
                type="number"
                value={clipBStartTime}
                onChange={(e) => setClipBStartTime(e.target.value)}
                placeholder="Start second (leave blank for heatmap auto-peak)"
                disabled={disabled || loading}
                className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-lg px-3.5 py-2 text-white placeholder-stone-500 text-xs transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Duration and CTA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-brand" /> Spotlight Duration
              </label>
              <span className="text-xs font-mono font-bold text-brand">{interval}s per clip</span>
            </div>
            <input
              type="range"
              min={5}
              max={12}
              value={interval}
              onChange={(e) => setIntervalVal(Number(e.target.value))}
              disabled={disabled || loading}
              className="w-full accent-brand"
            />
            <p className="text-[11px] text-stone-400">
              Total runtime: {interval * 2}s ({interval}s A, then {interval}s B).
            </p>
          </div>

          <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-brand" /> Bottom Call-to-Action
            </label>
            <input
              type="text"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              disabled={disabled || loading}
              className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-lg px-3.5 py-2.5 text-white text-xs transition-colors"
            />
            <p className="text-[11px] text-stone-400">
              Displays at the center split during video playback.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={disabled || loading || !clipAUrl.trim() || !clipBUrl.trim()}
          className="w-full btn-primary py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{statusMsg || 'Rendering Versus Comparison...'}</span>
            </>
          ) : (
            <>
              <Swords className="w-4 h-4" />
              <span>Generate Versus Video</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Gaming Split Form ────────────────────────────────────────────────────────

function GamingForm({
  disabled,
  onJobCreated,
}: {
  disabled?: boolean;
  onJobCreated?: (job: Job) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('bounce');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceUrl.trim()) return;
    setLoading(true);
    setError('');
    setStatusMsg('Locating highest-energy gameplay moment...');

    try {
      const payload: Record<string, unknown> = {
        sourceUrl: sourceUrl.trim(),
        captionStyle,
      };

      if (startTime.trim()) payload.startTime = Number(startTime);
      if (endTime.trim()) payload.endTime = Number(endTime);

      setStatusMsg('Downloading stream slice and generating 9:14 wide action composition...');

      const res = await fetch('/api/gaming-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to render gaming clip');

      if (data.job && onJobCreated) {
        onJobCreated(data.job);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  }

  return (
    <div className="bg-[#0E1118] border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-80 h-80 bg-brand/5 rounded-full blur-3xl pointer-events-none -ml-20 -mt-20" />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-brand">
          <Gamepad2 className="w-5 h-5 stroke-[2]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold text-base tracking-tight">Gaming Studio</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/[0.06] text-stone-300 border border-white/[0.08]">
              9:14 Action Framing
            </span>
          </div>
          <p className="text-stone-400 text-xs mt-0.5">
            Preserves camera framing and wide gameplay action cleanly without vertical split bars or cutoffs.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-stone-300 mb-2 uppercase tracking-wider">
            Stream VOD or Match Link
          </label>
          <div className="relative">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or Twitch VOD"
              required
              disabled={disabled || loading}
              className="w-full bg-[#141824] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-xl px-4 py-3.5 text-white placeholder-stone-500 text-sm transition-colors"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-stone-500 pointer-events-none">
              <Youtube className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand" /> Segment Range (Optional)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="Start (s) [Auto]"
                disabled={disabled || loading}
                className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-lg px-3 py-2 text-white placeholder-stone-500 text-xs transition-colors"
              />
              <input
                type="number"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="End (s) [Auto]"
                disabled={disabled || loading}
                className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-lg px-3 py-2 text-white placeholder-stone-500 text-xs transition-colors"
              />
            </div>
            <p className="text-[11px] text-stone-400">
              Leave blank to auto-detect the highest audience engagement peak.
            </p>
          </div>

          <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand" /> Caption Preset
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'bounce', label: 'Bounce' },
                { id: 'hype', label: 'Hype' },
                { id: 'clean', label: 'Clean' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCaptionStyle(s.id as CaptionStyle)}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                    captionStyle === s.id
                      ? 'bg-brand/15 border-brand/60 text-brand font-bold'
                      : 'bg-[#080A0F] border-white/[0.08] text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-400">Word-timed captions synced to speech.</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={disabled || loading || !sourceUrl.trim()}
          className="w-full btn-primary py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{statusMsg || 'Rendering Gaming Clip...'}</span>
            </>
          ) : (
            <>
              <Gamepad2 className="w-4 h-4" />
              <span>Generate Gaming Short</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Stream Stepper Form (4–6h Long VODs) ────────────────────────────────────

function StreamStepperForm({
  disabled,
  onJobCreated,
}: {
  disabled?: boolean;
  onJobCreated?: (job: Job) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [chunkMinutes, setChunkMinutes] = useState(20);
  const [startMinute, setStartMinute] = useState(0);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('bounce');
  const [frameLayout, setFrameLayout] = useState<FrameLayout>('blurred-fill');
  const [clipCount, setClipCount] = useState<number>(3);
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceUrl.trim()) return;

    setLoading(true);
    setError('');
    setStatusMsg('Inspecting long VOD metadata & setting up chunk windows...');

    try {
      const startChunkIndex = Math.max(0, Math.floor(startMinute / chunkMinutes));

      const res = await fetch('/api/stepper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          sourceUrl: sourceUrl.trim(),
          chunkMinutes,
          startChunkIndex,
          captionStyle,
          frameLayout,
          clipCount,
          userPrompt: userPrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start Stream Stepper');

      if (data.job && onJobCreated) {
        onJobCreated(data.job);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  }

  const startPartNum = Math.floor(startMinute / chunkMinutes) + 1;

  return (
    <div className="bg-[#0E1118] border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-brand/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand">
          <FastForward className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold text-base tracking-tight">Stream Stepper</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand/15 text-brand border border-brand/30">
              4–6h Long VODs
            </span>
          </div>
          <p className="text-stone-400 text-xs mt-0.5">
            Clip massive 3–6+ hour streams &amp; podcasts in on-demand 15–30 min chunks without downloading gigabytes of video. Review Part 1, then click Next Chunk!
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source URL */}
        <div>
          <label className="block text-xs font-semibold text-stone-300 mb-2 uppercase tracking-wider">
            YouTube or Twitch VOD URL (Up to 12 Hours)
          </label>
          <div className="relative">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... (Full stream or podcast)"
              required
              disabled={disabled || loading}
              className="w-full bg-[#141824] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-xl px-4 py-3.5 text-white placeholder-stone-500 text-sm pr-20 transition-colors"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-stone-500 pointer-events-none">
              <Youtube className="w-4 h-4" />
              <PlaySquare className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Chunk Duration & Start Position */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Chunk Window Duration */}
          <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider">
                Chunk Window Size
              </label>
              <span className="text-[11px] text-brand font-mono font-bold">{chunkMinutes} Min Chunks</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { mins: 15, label: '15m', desc: 'Bite-sized' },
                { mins: 20, label: '20m', desc: 'Recommended' },
                { mins: 30, label: '30m', desc: 'Podcast' },
                { mins: 45, label: '45m', desc: 'Deep' },
              ].map((c) => (
                <button
                  key={c.mins}
                  type="button"
                  onClick={() => setChunkMinutes(c.mins)}
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    chunkMinutes === c.mins
                      ? 'bg-brand/15 border-brand/60 text-white shadow-sm'
                      : 'bg-[#080A0F] border-white/[0.08] text-stone-400 hover:border-white/[0.18]'
                  }`}
                >
                  <p className="text-xs font-bold text-white">{c.label}</p>
                  <p className="text-[9px] text-stone-400 mt-0.5">{c.desc}</p>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-500">
              Downloads only ~5MB of speech audio per chunk using HTTP range requests.
            </p>
          </div>

          {/* Starting Position */}
          <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider">
                Starting Point
              </label>
              <span className="text-[11px] text-stone-400 font-mono">Starts at Part {startPartNum}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { mins: 0, label: 'Beginning', sub: '00:00:00' },
                { mins: 15, label: 'Skip Intro', sub: '00:15:00' },
                { mins: 60, label: 'Hour 1', sub: '01:00:00' },
              ].map((pos) => (
                <button
                  key={pos.mins}
                  type="button"
                  onClick={() => setStartMinute(pos.mins)}
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    startMinute === pos.mins
                      ? 'bg-brand/15 border-brand/60 text-white shadow-sm'
                      : 'bg-[#080A0F] border-white/[0.08] text-stone-400 hover:border-white/[0.18]'
                  }`}
                >
                  <p className="text-xs font-bold text-white">{pos.label}</p>
                  <p className="text-[9px] text-stone-400 mt-0.5">{pos.sub}</p>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-500">
              Start at the beginning or skip the pre-stream countdown / intro screen.
            </p>
          </div>
        </div>

        {/* Options Row (Captions & Layout) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Caption Style */}
          <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider">
              Caption Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'bounce', label: 'Bounce', desc: 'Karaoke Pop' },
                { id: 'hype', label: 'Hype', desc: 'High Energy' },
                { id: 'clean', label: 'Clean', desc: 'Minimal Sans' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCaptionStyle(s.id as CaptionStyle)}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    captionStyle === s.id
                      ? 'bg-brand/15 border-brand/60 text-white shadow-sm'
                      : 'bg-[#080A0F] border-white/[0.08] text-stone-400 hover:border-white/[0.18]'
                  }`}
                >
                  <p className="text-xs font-bold text-white">{s.label}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Frame Layout */}
          <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider">
              Vertical 9:16 Framing
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'blurred-fill', label: 'Blurred Fill', desc: '9:16 blurred depth background' },
                { id: 'center-crop', label: 'Center Crop', desc: 'Direct center 9:16 crop' },
              ].map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setFrameLayout(l.id as FrameLayout)}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    frameLayout === l.id
                      ? 'bg-brand/15 border-brand/60 text-white shadow-sm'
                      : 'bg-[#080A0F] border-white/[0.08] text-stone-400 hover:border-white/[0.18]'
                  }`}
                >
                  <p className="text-xs font-bold text-white">{l.label}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{l.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Target Topic / Scene Comment for Part 1 */}
        <div className="bg-[#141824] border border-white/[0.08] focus-within:border-brand/60 focus-within:ring-1 focus-within:ring-brand/30 rounded-xl p-4 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-200 uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5 text-brand" />
              <span>Topic Focus for Part {startPartNum} (Optional)</span>
            </label>
            {userPrompt && (
              <button
                type="button"
                onClick={() => setUserPrompt('')}
                className="text-[11px] text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-stone-400 mb-2.5 leading-relaxed">
            Know what happens in this part? Tell AI specific scenes, debates, or reactions you want cut out for sure from this chunk.
          </p>
          <input
            type="text"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder={`e.g., "The reaction to the boss fight", "The debate about AI", "When he starts laughing"...`}
            className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/60 focus:ring-1 focus:ring-brand/30 rounded-lg px-3.5 py-2.5 text-white placeholder-stone-500 text-xs sm:text-sm transition-colors"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={disabled || loading || !sourceUrl.trim()}
          className="w-full btn-primary py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{statusMsg || 'Analyzing Stream Windows...'}</span>
            </>
          ) : (
            <>
              <FastForward className="w-4 h-4" />
              <span>Start Part {startPartNum} (0:00 - {chunkMinutes}:00)</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Brand & Sponsor Studio Form ─────────────────────────────────────────────

function BrandCampaignForm({
  disabled,
  onJobCreated,
}: {
  disabled?: boolean;
  onJobCreated?: (job: Job) => void;
}) {
  const [videoTab, setVideoTab] = useState<'url' | 'upload'>('url');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Logo state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoName, setLogoName] = useState<string>('');
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('bottom-left');
  const [customX, setCustomX] = useState<number>(6);
  const [customY, setCustomY] = useState<number>(88);
  const [logoWidthPercent, setLogoWidthPercent] = useState<number>(18);
  const [logoOpacity, setLogoOpacity] = useState<number>(1.0);
  const [campaignTag, setCampaignTag] = useState<string>('');

  // Slicing & Style options
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('bounce');
  const [frameLayout, setFrameLayout] = useState<FrameLayout>('blurred-fill');
  const [clipCount, setClipCount] = useState<number>(3);
  const [userPrompt, setUserPrompt] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  function handleLogoSelected(file: File) {
    setLogoFile(file);
    setLogoName(file.name);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreview('');
    setLogoName('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (videoTab === 'url' && !videoUrl.trim()) return;
    if (videoTab === 'upload' && !videoFile) return;

    setLoading(true);
    setError('');
    setStatusMsg('Initializing Brand Campaign pipeline...');

    try {
      let uploadedLogoPath: string | undefined = undefined;
      let uploadedLogoUrl: string | undefined = undefined;

      // 1. Upload logo if provided
      if (logoFile) {
        setStatusMsg('Uploading and optimizing brand logo watermark...');
        const logoFormData = new FormData();
        logoFormData.append('file', logoFile);
        const logoRes = await fetch('/api/upload-logo', {
          method: 'POST',
          body: logoFormData,
        });
        const logoData = await logoRes.json();
        if (!logoRes.ok) {
          throw new Error(logoData.error || 'Failed to upload brand logo');
        }
        uploadedLogoPath = logoData.logoPath;
        uploadedLogoUrl = logoData.logoUrl;
      }

      const logoOverlay: LogoOverlay | undefined = uploadedLogoPath
        ? {
            path: uploadedLogoPath,
            url: uploadedLogoUrl,
            name: logoName,
            position: logoPosition,
            widthPercent: logoWidthPercent,
            opacity: logoOpacity,
            xPercent: logoPosition === 'custom' ? customX : undefined,
            yPercent: logoPosition === 'custom' ? customY : undefined,
            campaignTag: campaignTag.trim() || undefined,
          }
        : undefined;

      // 2. Submit job
      if (videoTab === 'url') {
        setStatusMsg('Slicing peak moments and overlaying brand watermark...');
        const res = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: videoUrl.trim(),
            captionStyle,
            frameLayout,
            clipCount,
            userPrompt: userPrompt.trim() || undefined,
            templateId: 'brand-campaign',
            logoOverlay,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start campaign video job');
        if (data.job && onJobCreated) onJobCreated(data.job);
      } else if (videoFile) {
        setStatusMsg('Uploading video file and processing brand watermark clips...');
        const form = new FormData();
        form.append('file', videoFile);
        form.append('captionStyle', captionStyle);
        form.append('frameLayout', frameLayout);
        form.append('clipCount', String(clipCount));
        if (userPrompt.trim()) form.append('userPrompt', userPrompt.trim());
        form.append('templateId', 'brand-campaign');
        if (logoOverlay) {
          form.append('logoOverlay', JSON.stringify(logoOverlay));
        }

        const res = await fetch('/api/process', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start campaign video upload');
        if (data.job && onJobCreated) onJobCreated(data.job);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  }

  // CSS positioning for the live 9:16 interactive preview
  function getPreviewPositionStyle(): React.CSSProperties {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: `${logoWidthPercent}%`,
      opacity: logoOpacity,
      transition: 'all 0.25s ease-out',
    };

    switch (logoPosition) {
      case 'bottom-left':
        return { ...base, bottom: '13%', left: '6%' };
      case 'bottom-right':
        return { ...base, bottom: '13%', right: '6%' };
      case 'top-left':
        return { ...base, top: '6%', left: '6%' };
      case 'top-right':
        return { ...base, top: '6%', right: '6%' };
      case 'top-center':
        return { ...base, top: '6%', left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-center':
        return { ...base, bottom: '13%', left: '50%', transform: 'translateX(-50%)' };
      case 'center':
        return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case 'custom':
        return {
          ...base,
          left: `${customX}%`,
          top: `${customY}%`,
          transform: 'translate(-50%, -50%)',
        };
      default:
        return { ...base, bottom: '13%', left: '6%' };
    }
  }

  return (
    <div className="bg-[#0E1118] border border-brand/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Header */}
      <div className="border-b border-white/[0.08] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand shadow-lg shadow-brand/10">
            <Award className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-base tracking-tight">Campaign &amp; Sponsor Studio</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Watermark Mode
              </span>
            </div>
            <p className="text-stone-400 text-xs mt-0.5">
              Automatically extract viral moments and brand each clip with your sponsor or campaign logo anywhere on screen.
            </p>
          </div>
        </div>

        {/* Status pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141824] border border-white/[0.08] text-xs">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="text-stone-400">Default Position:</span>
          <span className="text-white font-bold font-mono uppercase">
            {logoPosition}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Video Input */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#141824] rounded-xl border border-white/[0.08] max-w-fit">
            <button
              type="button"
              onClick={() => setVideoTab('url')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                videoTab === 'url' ? 'bg-brand text-[#080A0F] shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Paste Video URL</span>
            </button>
            <button
              type="button"
              onClick={() => setVideoTab('upload')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                videoTab === 'upload' ? 'bg-brand text-[#080A0F] shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Video File</span>
            </button>
          </div>

          {videoTab === 'url' ? (
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-2 uppercase tracking-wider">
                Source Stream or Video URL (YouTube, Twitch, MP4)
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                  disabled={disabled || loading}
                  className="w-full bg-[#141824] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-xl px-4 py-3 text-white placeholder-stone-500 text-sm pr-20 transition-colors"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-stone-500 pointer-events-none">
                  <Youtube className="w-4 h-4" />
                  <PlaySquare className="w-4 h-4" />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-2 uppercase tracking-wider">
                Upload Campaign Video File (MP4, MOV, WebM)
              </label>
              <div className="border border-dashed border-white/[0.12] rounded-xl p-6 text-center hover:border-brand/50 transition-colors bg-[#141824] relative cursor-pointer">
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setVideoFile(e.target.files[0]);
                  }}
                  disabled={disabled || loading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <Upload className="w-6 h-6 text-brand" />
                  <p className="text-xs text-stone-300 font-medium">
                    {videoFile ? (
                      <span className="text-brand font-bold">{videoFile.name}</span>
                    ) : (
                      'Drag & drop campaign video here or browse files'
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Brand Logo & Interactive Placement Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 rounded-2xl bg-[#121622] border border-brand/20">
          {/* Controls Column (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-brand" />
                  <span>1. Upload Campaign / Sponsor Logo</span>
                </label>
                {logoName && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Remove Logo
                  </button>
                )}
              </div>

              {!logoPreview ? (
                <div className="border border-dashed border-brand/40 hover:border-brand rounded-xl p-5 text-center bg-[#0a0d14] relative transition-colors cursor-pointer group">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleLogoSelected(e.target.files[0]);
                    }}
                    disabled={disabled || loading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand group-hover:scale-105 transition-transform">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Click or drag logo image here</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">PNG with transparency recommended (JPG, SVG, WebP also supported)</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-brand/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-black/60 border border-white/10 p-1 flex items-center justify-center overflow-hidden">
                      <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white line-clamp-1">{logoName}</p>
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 font-semibold">
                        <Check className="w-3 h-3" /> Ready for Overlay
                      </p>
                    </div>
                  </div>
                  <label className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-stone-200 border border-white/[0.1] cursor-pointer transition-colors">
                    Replace
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleLogoSelected(e.target.files[0]);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* 2. Position Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white uppercase tracking-wider">
                2. Logo Placement on 9:16 Video
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: 'bottom-left' as LogoPosition,
                    label: 'Bottom Left',
                    badge: 'Recommended',
                    desc: 'Cleanly above mobile title',
                  },
                  {
                    id: 'bottom-right' as LogoPosition,
                    label: 'Bottom Right',
                    desc: 'Opposite handle corner',
                  },
                  {
                    id: 'top-left' as LogoPosition,
                    label: 'Top Left',
                    desc: 'Broadcast TV bug style',
                  },
                  {
                    id: 'top-right' as LogoPosition,
                    label: 'Top Right',
                    desc: 'Classic watermark badge',
                  },
                  {
                    id: 'top-center' as LogoPosition,
                    label: 'Top Center',
                    desc: 'Centered sponsor header',
                  },
                  {
                    id: 'custom' as LogoPosition,
                    label: 'Custom Pinpoint',
                    desc: 'Free X/Y coordinates',
                  },
                ].map((pos) => {
                  const isPicked = logoPosition === pos.id;
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => setLogoPosition(pos.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                        isPicked
                          ? 'bg-brand/20 border-brand text-white shadow-md shadow-brand/10'
                          : 'bg-[#0a0d14] border-white/[0.08] text-stone-400 hover:border-white/[0.18]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isPicked ? 'text-white' : 'text-stone-300'}`}>
                          {pos.label}
                        </span>
                        {pos.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-brand/25 text-brand">
                            {pos.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1">{pos.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Custom Sliders if Custom Pinpoint is selected */}
              {logoPosition === 'custom' && (
                <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-white/[0.08] space-y-3 pt-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-400">Horizontal Position (X):</span>
                      <span className="font-mono text-brand font-bold">{customX}%</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="95"
                      value={customX}
                      onChange={(e) => setCustomX(Number(e.target.value))}
                      className="w-full accent-brand cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-400">Vertical Position (Y):</span>
                      <span className="font-mono text-brand font-bold">{customY}%</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="95"
                      value={customY}
                      onChange={(e) => setCustomY(Number(e.target.value))}
                      className="w-full accent-brand cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Scale & Opacity Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Logo Size */}
              <div className="p-3 rounded-xl bg-[#0a0d14] border border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider">
                    Logo Width Scale
                  </label>
                  <span className="text-xs font-mono font-bold text-brand">{logoWidthPercent}%</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="38"
                  value={logoWidthPercent}
                  onChange={(e) => setLogoWidthPercent(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                  <span>Small (12%)</span>
                  <span>Normal (18%)</span>
                  <span>Large (30%)</span>
                </div>
              </div>

              {/* Logo Opacity */}
              <div className="p-3 rounded-xl bg-[#0a0d14] border border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider">
                    Watermark Opacity
                  </label>
                  <span className="text-xs font-mono font-bold text-brand">{Math.round(logoOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={Math.round(logoOpacity * 100)}
                  onChange={(e) => setLogoOpacity(Number(e.target.value) / 100)}
                  className="w-full accent-brand cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                  <span>Ghosted (50%)</span>
                  <span>Subtle (85%)</span>
                  <span>Solid (100%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live 9:16 Interactive Phone Mockup Column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-[#0a0d14] rounded-xl border border-white/[0.06]">
            <div className="text-center mb-3">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-white/[0.06] text-stone-300">
                Live 9:16 Placement Preview
              </span>
            </div>

            {/* 9:16 Phone Mockup Canvas */}
            <div className="relative w-48 sm:w-52 aspect-[9/16] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-gradient-to-b from-stone-900 via-[#10131d] to-[#07090e]">
              {/* Fake video background content */}
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#2a324b_1px,transparent_1px)] [background-size:16px_16px]" />

              {/* Top overlay hint */}
              <div className="absolute top-2.5 inset-x-3 flex items-center justify-between opacity-50">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[8px] font-mono text-stone-400">9:16 VERTICAL SHORTS</span>
              </div>

              {/* Fake Subtitle Layer (lower-middle) */}
              <div className="absolute bottom-[28%] inset-x-3 text-center pointer-events-none">
                <span className="px-2 py-0.5 rounded bg-black/80 text-yellow-300 font-extrabold text-[10px] uppercase shadow-lg border border-yellow-400/20">
                  LOOK AT THIS MOMENT!
                </span>
              </div>

              {/* THE LOGO OVERLAY PREVIEW */}
              {logoPreview ? (
                <div style={getPreviewPositionStyle()} className="pointer-events-none select-none z-20">
                  <img
                    src={logoPreview}
                    alt="Logo Preview"
                    className="w-full h-auto object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]"
                  />
                </div>
              ) : (
                <div
                  style={getPreviewPositionStyle()}
                  className="pointer-events-none select-none z-20 border-2 border-dashed border-brand/80 rounded-lg p-1 text-center bg-brand/10 backdrop-blur-xs"
                >
                  <span className="text-[8px] font-bold text-brand uppercase block whitespace-nowrap">
                    📍 Logo Place
                  </span>
                </div>
              )}

              {/* Bottom Mobile UI Safe Zone (Reels/Shorts handle simulation) */}
              <div className="absolute bottom-1.5 inset-x-2.5 p-1 rounded bg-black/40 backdrop-blur-[2px] pointer-events-none">
                <div className="w-12 h-1 rounded-full bg-white/40 mb-1" />
                <div className="w-20 h-0.5 rounded-full bg-white/20" />
              </div>
            </div>

            <p className="text-[11px] text-stone-400 text-center mt-3 max-w-[200px] leading-tight">
              Logo will be burned cleanly at <span className="font-bold text-brand uppercase">{logoPosition}</span> with zero quality loss.
            </p>
          </div>
        </div>

        {/* Step 3: Scene matching prompt & output options */}
        <div className="space-y-4">
          {/* Specific scene targeting */}
          <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-brand" />
                <span>Campaign Focus &amp; Scene Comment (Optional)</span>
              </label>
              <span className="text-[10px] text-brand font-semibold">AI Context Matching</span>
            </div>
            <input
              type="text"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder='e.g. "when streamer presents the sponsor product", "the unboxing segment", "the debate"...'
              disabled={disabled || loading}
              className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-xl px-4 py-2.5 text-white placeholder-stone-500 text-xs transition-colors"
            />
          </div>

          {/* Caption Style & Framing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Captions */}
            <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
                Captions
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'bounce', label: 'Bounce' },
                  { id: 'hype', label: 'Hype' },
                  { id: 'clean', label: 'Clean' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCaptionStyle(s.id as CaptionStyle)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      captionStyle === s.id
                        ? 'bg-brand/15 border-brand/60 text-brand font-bold'
                        : 'bg-[#080A0F] border-white/[0.08] text-stone-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Framing */}
            <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
                9:16 Framing
              </label>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { id: 'blurred-fill', label: 'Blurred Fill' },
                  { id: 'center-crop', label: 'Center Crop' },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setFrameLayout(l.id as FrameLayout)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      frameLayout === l.id
                        ? 'bg-brand/15 border-brand/60 text-brand font-bold'
                        : 'bg-[#080A0F] border-white/[0.08] text-stone-400'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Output Clip Count */}
            <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
                Clips to Generate
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[3, 5, 8].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setClipCount(c)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      clipCount === c
                        ? 'bg-brand/15 border-brand/60 text-brand font-bold'
                        : 'bg-[#080A0F] border-white/[0.08] text-stone-400'
                    }`}
                  >
                    {c} Clips
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={disabled || loading || (videoTab === 'url' ? !videoUrl.trim() : !videoFile)}
          className="w-full btn-primary py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{statusMsg || 'Generating Campaign Clips...'}</span>
            </>
          ) : (
            <>
              <Award className="w-4 h-4" />
              <span>
                {logoFile
                  ? `Generate ${clipCount} Campaign Shorts with "${logoPosition}" Logo`
                  : `Generate ${clipCount} Campaign Shorts`}
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Main Form (Template 1: Viral Clipper) ────────────────────────────────────

export default function UrlInputForm({
  onSubmitUrl,
  onSubmitFile,
  onJobCreated,
  disabled,
  templateId = 'viral-clipper',
}: UrlInputFormProps) {
  const [tab, setTab] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('bounce');
  const [frameLayout, setFrameLayout] = useState<FrameLayout>('blurred-fill');
  const [clipCount, setClipCount] = useState<number>(3);
  const [userPrompt, setUserPrompt] = useState<string>('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === 'url' && url.trim()) {
      onSubmitUrl(url.trim(), captionStyle, frameLayout, clipCount, userPrompt.trim());
    } else if (tab === 'upload' && selectedFile) {
      onSubmitFile(selectedFile, captionStyle, frameLayout, clipCount, userPrompt.trim());
    }
  }

  if (templateId === 'versus-comparison') {
    return <VersusForm disabled={disabled} onJobCreated={onJobCreated} />;
  }

  if (templateId === 'gaming-split') {
    return <GamingForm disabled={disabled} onJobCreated={onJobCreated} />;
  }

  if (templateId === 'stream-stepper') {
    return <StreamStepperForm disabled={disabled} onJobCreated={onJobCreated} />;
  }

  if (templateId === 'brand-campaign') {
    return <BrandCampaignForm disabled={disabled} onJobCreated={onJobCreated} />;
  }

  return (
    <div className="bg-[#0E1118] border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-brand/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Tabs */}
      <div className="flex items-center gap-1.5 mb-6 p-1 bg-[#141824] rounded-xl border border-white/[0.08] max-w-fit">
        <button
          type="button"
          onClick={() => setTab('url')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            tab === 'url'
              ? 'bg-brand text-[#080A0F] shadow-sm'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Paste Video Link</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            tab === 'upload'
              ? 'bg-brand text-[#080A0F] shadow-sm'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload File</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Input Field */}
        {tab === 'url' ? (
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-2 uppercase tracking-wider">
              Paste YouTube or Twitch VOD URL
            </label>
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                disabled={disabled}
                className="w-full bg-[#141824] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-xl px-4 py-3.5 text-white placeholder-stone-500 text-sm pr-20 transition-colors"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-stone-500 pointer-events-none">
                <Youtube className="w-4 h-4" />
                <PlaySquare className="w-4 h-4" />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-2 uppercase tracking-wider">
              Select Video File (MP4, MOV, WebM)
            </label>
            <div className="border border-dashed border-white/[0.12] rounded-xl p-8 text-center hover:border-brand/50 transition-colors bg-[#141824] relative cursor-pointer">
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                }}
                disabled={disabled}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-6 h-6 text-brand mx-auto mb-2" />
              <p className="text-xs font-semibold text-stone-200">
                {selectedFile ? selectedFile.name : 'Click or drop video file here'}
              </p>
              <p className="text-[11px] text-stone-500 mt-1">
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                  : 'Up to 2 GB local file'}
              </p>
            </div>
          </div>
        )}

        {/* Custom Scene / Topic Comments */}
        <div className="bg-[#141824] border border-white/[0.08] focus-within:border-brand/60 focus-within:ring-1 focus-within:ring-brand/30 rounded-xl p-4 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-200 uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5 text-brand" />
              <span>Target Scene &amp; Topic Comments</span>
              <span className="text-[10px] font-normal normal-case text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-md">
                Smart Scene Matcher
              </span>
            </label>
            {userPrompt && (
              <button
                type="button"
                onClick={() => setUserPrompt('')}
                className="text-[11px] text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-stone-400 mb-2.5 leading-relaxed">
            Seen this video? Add your comment on specific topics, quotes, or scenes you want cut out for sure. PeakCut will scan the transcript to recognize and cutout that exact scene!
          </p>
          <div className="relative">
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder='e.g., "Cut out the scene where they debate about AI", "The funny jumpscare reaction", "Topic at 14:20 where he talks about quitting"'
              rows={2}
              disabled={disabled}
              className="w-full bg-[#080A0F] border border-white/[0.08] focus:border-brand/60 focus:ring-1 focus:ring-brand/30 rounded-lg px-3.5 py-2.5 text-white placeholder-stone-500 text-xs sm:text-sm resize-none transition-colors"
            />
          </div>

          {/* Quick Topic Suggestions */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <span className="text-[10px] text-stone-500 flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-brand" /> Quick Ideas:
            </span>
            {[
              'Cut the funniest joke or laugh',
              'When the argument starts',
              'The plot twist or big reveal',
              'The reaction moment',
            ].map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setUserPrompt(idea)}
                className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] hover:text-stone-200 border border-white/[0.06] text-[10px] text-stone-400 transition-colors cursor-pointer"
              >
                + {idea}
              </button>
            ))}
          </div>
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Caption Style */}
          <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider">
              Caption Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'bounce', label: 'Bounce', desc: 'Karaoke Pop' },
                { id: 'hype', label: 'Hype', desc: 'High Energy' },
                { id: 'clean', label: 'Clean', desc: 'Minimal Sans' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCaptionStyle(s.id as CaptionStyle)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    captionStyle === s.id
                      ? 'bg-brand/15 border-brand/60 text-white shadow-sm'
                      : 'bg-[#080A0F] border-white/[0.08] text-stone-400 hover:border-white/[0.18]'
                  }`}
                >
                  <p className="text-xs font-bold text-white">{s.label}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Frame Layout */}
          <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider">
              Vertical 9:16 Framing
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'blurred-fill', label: 'Blurred Fill', desc: '9:16 blurred depth background' },
                { id: 'center-crop', label: 'Center Crop', desc: 'Direct center 9:16 crop' },
              ].map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setFrameLayout(l.id as FrameLayout)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    frameLayout === l.id
                      ? 'bg-brand/15 border-brand/60 text-white shadow-sm'
                      : 'bg-[#080A0F] border-white/[0.08] text-stone-400 hover:border-white/[0.18]'
                  }`}
                >
                  <p className="text-xs font-bold text-white">{l.label}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{l.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output Clip Count & Virality Depth */}
        <div className="bg-[#141824] border border-white/[0.08] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider">
              Output Clip Count &amp; Virality Depth
            </label>
            <span className="text-[11px] text-brand font-mono font-bold">{clipCount} Vertical Clips</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { count: 3, label: '3 Clips', desc: 'Top Viral Peaks (90+)' },
              { count: 5, label: '5 Clips', desc: 'Balanced Variety (75+)' },
              { count: 8, label: '8 Clips', desc: 'Deep Harvest (60+)' },
            ].map((c) => (
              <button
                key={c.count}
                type="button"
                onClick={() => setClipCount(c.count)}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  clipCount === c.count
                    ? 'bg-brand/15 border-brand/60 text-white shadow-sm'
                    : 'bg-[#080A0F] border-white/[0.08] text-stone-400 hover:border-white/[0.18]'
                }`}
              >
                <p className="text-xs font-bold text-white">{c.label}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">{c.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={disabled || (tab === 'url' ? !url.trim() : !selectedFile)}
          className="w-full btn-primary py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Wand2 className="w-4 h-4 stroke-[2.5]" />
          <span>
            {userPrompt.trim()
              ? `Generate ${clipCount} Shorts (Targeting Your Scene)`
              : `Generate ${clipCount} Viral Shorts`}
          </span>
        </button>
      </form>
    </div>
  );
}
