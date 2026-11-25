'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Scissors,
  Crop,
  Type,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  Sparkles,
  Move,
  Plus,
  Trash2,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Award,
  Image as ImageIcon,
  Upload,
  Check,
} from 'lucide-react';
import { Clip, FrameLayout, TextOverlay, LogoOverlay, LogoPosition } from '@/lib/types';

interface EditModePanelProps {
  clip: Clip;
  jobId: string;
  onClose: () => void;
  onClipUpdated?: (updatedClip: Clip) => void;
}

type TabKey = 'text' | 'branding' | 'trim' | 'crop' | 'subtitles' | 'speed';

function stripEmojis(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u26FF\u2700-\u27BF\u2300-\u23FF\uFE0F\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDefaultOverlays(clip: Clip, jobId: string): TextOverlay[] {
  if (Array.isArray(clip.overlays) && clip.overlays.length > 0) {
    return clip.overlays.map((ov) => ({ ...ov, text: stripEmojis(ov.text) }));
  }

  // Detect Versus Studio clip
  const isVersus =
    jobId.includes('vs') ||
    clip.title.toLowerCase().includes(' vs ') ||
    clip.hook.toLowerCase().includes(' vs ');

  if (isVersus) {
    const parts = clip.title.split(/ vs /i);
    const labelA = stripEmojis(parts[0]?.trim() || 'Original Version');
    const labelB = stripEmojis(parts[1]?.replace(/\[.*\]/, '').trim() || 'New Version');

    return [
      {
        id: 'topLabel',
        text: labelA,
        xPercent: 50,
        yPercent: 4,
        fontSize: 38,
        fontColor: 'white',
        bgColor: 'none',
      },
      {
        id: 'vsBadge',
        text: 'VS',
        xPercent: 50,
        yPercent: 50,
        fontSize: 54,
        fontColor: 'yellow',
        bgColor: 'none',
      },
      {
        id: 'botLabel',
        text: labelB,
        xPercent: 50,
        yPercent: 56,
        fontSize: 38,
        fontColor: 'white',
        bgColor: 'none',
      },
    ];
  }

  // Default Viral / Gaming clip
  const hookText = stripEmojis(clip.hook || 'TOP MOMENT');
  return [
    {
      id: 'hook',
      text: hookText,
      xPercent: 50,
      yPercent: 6,
      fontSize: 40,
      fontColor: 'yellow',
      bgColor: 'none', // clean text, no box border
    },
  ];
}

export default function EditModePanel({
  clip,
  jobId,
  onClose,
  onClipUpdated,
}: EditModePanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('text');

  // ── Overlays State (Draggable & Fully Editable) ──────────────────────────────
  const [overlays, setOverlays] = useState<TextOverlay[]>(() =>
    getDefaultOverlays(clip, jobId)
  );
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    overlays[0]?.id || null
  );

  // ── Logo Overlay State ───────────────────────────────────────────────────────
  const [logoOverlay, setLogoOverlay] = useState<LogoOverlay | null>(
    clip.logoOverlay || null
  );
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);

  // ── Editor State ────────────────────────────────────────────────────────────
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [layout, setLayout] = useState<FrameLayout | 'fit'>(clip.layout || 'blurred-fill');
  const [fontMultiplier, setFontMultiplier] = useState<number>(1.0);
  const [subtitleY, setSubtitleY] = useState<number>(0.8);
  const [speed, setSpeed] = useState<number>(1.0);

  // ── Video & Playback State ──────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(clip.duration || 30);
  const [activeUrl, setActiveUrl] = useState<string>(clip.publicUrl);

  // ── Dragging State ──────────────────────────────────────────────────────────
  const [draggingOverlayId, setDraggingOverlayId] = useState<string | null>(null);
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState<boolean>(false);

  // ── Processing State ────────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [lastSavedClip, setLastSavedClip] = useState<Clip | null>(null);

  const effectiveDuration = Math.max(3, (videoDuration - trimStart - trimEnd) / speed);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Video Controls
  function togglePlay() {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }

  function seekRelative(delta: number) {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoDuration, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  }

  // ── Drag & Drop Engine on Video Canvas ──────────────────────────────────────
  const handlePointerDownOverlay = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingOverlayId(id);
    setSelectedOverlayId(id);
  };

  const handlePointerDownSubtitle = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingSubtitle(true);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();

      if (draggingOverlayId) {
        const xRaw = ((e.clientX - rect.left) / rect.width) * 100;
        const yRaw = ((e.clientY - rect.top) / rect.height) * 100;
        const xClamped = Math.max(6, Math.min(94, Math.round(xRaw)));
        const yClamped = Math.max(4, Math.min(96, Math.round(yRaw)));

        setOverlays((prev) =>
          prev.map((ov) =>
            ov.id === draggingOverlayId
              ? { ...ov, xPercent: xClamped, yPercent: yClamped }
              : ov
          )
        );
      } else if (isDraggingSubtitle) {
        const yRaw = (e.clientY - rect.top) / rect.height;
        const yClamped = Math.max(0.15, Math.min(0.9, Number(yRaw.toFixed(2))));
        setSubtitleY(yClamped);
      }
    },
    [draggingOverlayId, isDraggingSubtitle]
  );

  const handlePointerUp = useCallback(() => {
    setDraggingOverlayId(null);
    setIsDraggingSubtitle(false);
  }, []);

  // Update specific overlay property
  function updateOverlay(id: string, updates: Partial<TextOverlay>) {
    setOverlays((prev) =>
      prev.map((ov) => {
        if (ov.id !== id) return ov;
        const updated = { ...ov, ...updates };
        if (updates.text !== undefined) {
          updated.text = stripEmojis(updates.text);
        }
        return updated;
      })
    );
  }

  function addOverlay() {
    const newId = `text_${Date.now()}`;
    const newOv: TextOverlay = {
      id: newId,
      text: 'NEW TEXT',
      xPercent: 50,
      yPercent: 30,
      fontSize: 36,
      fontColor: 'yellow',
      bgColor: 'black@0.75',
    };
    setOverlays((prev) => [...prev, newOv]);
    setSelectedOverlayId(newId);
    setActiveTab('text');
  }

  function deleteOverlay(id: string) {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedOverlayId === id) {
      setSelectedOverlayId(null);
    }
  }

  function getLogoPreviewStyle(logo: LogoOverlay): React.CSSProperties {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: `${logo.widthPercent || 18}%`,
      opacity: logo.opacity ?? 1.0,
      transition: 'all 0.2s ease',
    };

    switch (logo.position) {
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
          left: `${logo.xPercent ?? 6}%`,
          top: `${logo.yPercent ?? 88}%`,
          transform: 'translate(-50%, -50%)',
        };
      default:
        return { ...base, bottom: '13%', left: '6%' };
    }
  }

  async function handleUploadLogoFile(file: File) {
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-logo', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload logo');

      setLogoOverlay((prev) => ({
        path: data.logoPath,
        url: data.logoUrl,
        name: file.name,
        position: prev?.position || 'bottom-left',
        widthPercent: prev?.widthPercent || 18,
        opacity: prev?.opacity ?? 1.0,
        xPercent: prev?.xPercent ?? 6,
        yPercent: prev?.yPercent ?? 88,
      }));
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setIsUploadingLogo(false);
    }
  }

  // Quick Trim Presets
  function applyTrimPreset(preset: 'all' | 'first15' | 'first30' | 'cut5start') {
    if (preset === 'all') {
      setTrimStart(0);
      setTrimEnd(0);
    } else if (preset === 'first15') {
      setTrimStart(0);
      setTrimEnd(Math.max(0, videoDuration - 15));
    } else if (preset === 'first30') {
      setTrimStart(0);
      setTrimEnd(Math.max(0, videoDuration - 30));
    } else if (preset === 'cut5start') {
      setTrimStart(Math.min(5, Math.max(0, videoDuration - 10)));
    }
  }

  // Re-Render Handler
  async function handleApplyAndRerender() {
    setIsProcessing(true);
    setErrorMsg('');
    setProcessStatus('Rendering custom clip with repositioned text & typography...');

    // Clean all emojis before transmitting to backend
    const cleanedOverlays = overlays.map((o) => ({
      ...o,
      text: stripEmojis(o.text),
    }));

    try {
      const res = await fetch('/api/rerender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId: clip.id,
          jobId,
          layout,
          fontSizeMultiplier: fontMultiplier,
          subtitleYRatio: subtitleY,
          trimStart,
          trimEnd,
          speed,
          textOverlays: cleanedOverlays,
          logoOverlay: logoOverlay || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Re-rendering failed.');
      }

      setProcessStatus('Clip successfully re-exported with your placements!');
      setLastSavedClip(data.clip);
      setActiveUrl(`${data.publicUrl}?t=${Date.now()}`);

      if (videoRef.current) {
        videoRef.current.src = `${data.publicUrl}?t=${Date.now()}`;
        videoRef.current.load();
        setTrimStart(0);
        setTrimEnd(0);
      }

      if (onClipUpdated && data.clip) {
        onClipUpdated(data.clip);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setProcessStatus('');
    } finally {
      setIsProcessing(false);
    }
  }

  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-6xl h-[92vh] bg-[#0c0e14] border border-stone-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* ── Top Header ──────────────────────────────────────────────────────── */}
        <header className="px-6 py-4 border-b border-stone-800/80 bg-[#12151d] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-base tracking-tight">Studio Video Editor</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                  Drag &amp; Drop Text
                </span>
              </div>
              <p className="text-xs text-stone-400 line-clamp-1 mt-0.5">{clip.title}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* ── Main Workspace ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* ── LEFT: 9:16 Video Player with Draggable Overlays ────────────────── */}
          <div className="lg:w-[420px] xl:w-[460px] bg-black border-r border-stone-800/80 flex flex-col flex-shrink-0">
            {/* 9:16 Canvas Area */}
            <div className="flex-1 relative flex items-center justify-center p-3 min-h-0 overflow-hidden bg-radial-gradient">
              <div
                ref={canvasRef}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="relative h-full aspect-[9/16] max-h-full rounded-2xl overflow-hidden shadow-2xl bg-stone-950 border border-stone-800/60 select-none touch-none"
              >
                <video
                  ref={videoRef}
                  src={activeUrl}
                  className="w-full h-full object-cover pointer-events-none"
                  playsInline
                  preload="metadata"
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => {
                    const dur = videoRef.current?.duration || clip.duration || 30;
                    setVideoDuration(dur);
                  }}
                  onEnded={() => setIsPlaying(false)}
                />

                {/* Big Center Play Hint (shown only when idle & not dragging) */}
                {!isPlaying && !draggingOverlayId && !isDraggingSubtitle && (
                  <div
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] cursor-pointer group z-20"
                  >
                    <div className="w-14 h-14 rounded-full bg-brand text-dark-frame flex items-center justify-center shadow-xl shadow-brand/30 group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 fill-dark-frame ml-0.5" />
                    </div>
                  </div>
                )}

                {/* ── DRAGGABLE TEXT OVERLAYS ──────────────────────────────── */}
                {overlays.map((ov) => {
                  const isSelected = selectedOverlayId === ov.id;
                  const isDragging = draggingOverlayId === ov.id;

                  const colorClass =
                    ov.fontColor === 'yellow'
                      ? 'text-yellow-300'
                      : ov.fontColor === 'cyan'
                      ? 'text-cyan-300'
                      : ov.fontColor === 'lime'
                      ? 'text-lime-300'
                      : ov.fontColor === 'red'
                      ? 'text-red-400'
                      : 'text-white';

                  const boxClass =
                    ov.bgColor && ov.bgColor !== 'none'
                      ? 'bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-2xl'
                      : 'px-2 py-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]';

                  return (
                    <div
                      key={ov.id}
                      onPointerDown={(e) => handlePointerDownOverlay(e, ov.id)}
                      style={{
                        left: `${ov.xPercent}%`,
                        top: `${ov.yPercent}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className={`absolute z-30 cursor-move transition-transform active:scale-105 select-none ${
                        isDragging ? 'opacity-90 ring-2 ring-brand' : ''
                      }`}
                    >
                      <div
                        className={`text-center flex items-center gap-1.5 ${boxClass} ${colorClass} ${
                          isSelected ? 'ring-2 ring-brand/80 rounded-xl shadow-brand/30' : ''
                        }`}
                      >
                        <Move className="w-3 h-3 opacity-60 flex-shrink-0" />
                        <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">
                          {ov.text || 'UNTITLED'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* ── DRAGGABLE SUBTITLE BAR ───────────────────────────────── */}
                <div
                  onPointerDown={handlePointerDownSubtitle}
                  style={{
                    top: `${Math.round(subtitleY * 100)}%`,
                    transform: 'translateY(-50%)',
                  }}
                  className={`absolute inset-x-4 z-25 cursor-ns-resize transition-all ${
                    isDraggingSubtitle ? 'opacity-100 ring-2 ring-brand' : 'opacity-85'
                  }`}
                >
                  <div className="py-2 px-3 rounded-xl bg-black/75 border border-dashed border-brand/60 text-center backdrop-blur-sm flex items-center justify-center gap-2">
                    <span className="text-[11px] font-bold text-brand uppercase tracking-wider">
                      [Subtitles Zone: Drag Up / Down]
                    </span>
                  </div>
                </div>

                {/* ── LIVE BRAND LOGO WATERMARK PREVIEW ────────────────────── */}
                {logoOverlay && (logoOverlay.url || logoOverlay.path) && (
                  <div
                    style={getLogoPreviewStyle(logoOverlay)}
                    className="absolute z-35 pointer-events-none select-none transition-all"
                  >
                    <img
                      src={
                        logoOverlay.url ||
                        (logoOverlay.path
                          ? `/api/logos/${logoOverlay.path.split('/').pop()}`
                          : '')
                      }
                      alt="Brand Logo"
                      className="w-full h-auto object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Transport & Timeline Controls */}
            <div className="p-4 bg-[#10121a] border-t border-stone-800/80 space-y-3 flex-shrink-0">
              <div className="flex items-center justify-between text-xs font-mono text-stone-400">
                <span className="text-white font-semibold">{formatTime(currentTime)}</span>
                <span className="text-[11px] text-brand font-bold bg-brand/10 px-2 py-0.5 rounded-md border border-brand/20">
                  {effectiveDuration.toFixed(1)}s final clip
                </span>
                <span>{formatTime(videoDuration)}</span>
              </div>

              {/* Scrubber Bar */}
              <div className="relative py-1">
                {trimStart > 0 && (
                  <div
                    className="absolute top-1 bottom-1 left-0 bg-red-500/25 border-r border-red-500/70 rounded-l pointer-events-none flex items-center justify-center"
                    style={{ width: `${Math.min(100, (trimStart / videoDuration) * 100)}%` }}
                  >
                    <span className="text-[9px] font-bold text-red-300 uppercase">Cut</span>
                  </div>
                )}
                {trimEnd > 0 && (
                  <div
                    className="absolute top-1 bottom-1 right-0 bg-red-500/25 border-l border-red-500/70 rounded-r pointer-events-none flex items-center justify-center"
                    style={{ width: `${Math.min(100, (trimEnd / videoDuration) * 100)}%` }}
                  >
                    <span className="text-[9px] font-bold text-red-300 uppercase">Cut</span>
                  </div>
                )}
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 30}
                  step={0.1}
                  value={currentTime}
                  onChange={handleScrub}
                  className="w-full accent-brand cursor-pointer relative z-10"
                />
              </div>

              {/* Transport Buttons */}
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => seekRelative(-5)}
                  className="p-2 rounded-xl bg-stone-800/60 hover:bg-stone-800 text-stone-300 transition-colors cursor-pointer"
                  title="Rewind 5s"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-dark-frame font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-brand/20 transition-all cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-dark-frame" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-dark-frame" />
                      <span>Play</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => seekRelative(5)}
                  className="p-2 rounded-xl bg-stone-800/60 hover:bg-stone-800 text-stone-300 transition-colors cursor-pointer"
                  title="Forward 5s"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Studio Suite Tabs ─────────────────────────────────────── */}
          <div className="flex-1 flex flex-col bg-[#0f1118] min-h-0 overflow-hidden">
            {/* Tab Navigation */}
            <div className="px-6 pt-4 pb-2 border-b border-stone-800/80 bg-[#12151e] flex items-center gap-2 overflow-x-auto flex-shrink-0">
              {[
                { id: 'text' as TabKey, label: 'Edit Text & Placements', icon: Type },
                { id: 'branding' as TabKey, label: 'Logo & Branding', icon: Award },
                { id: 'trim' as TabKey, label: 'Trim & Timing', icon: Scissors },
                { id: 'crop' as TabKey, label: 'Framing & Crop', icon: Crop },
                { id: 'subtitles' as TabKey, label: 'Subtitles & Style', icon: Zap },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-brand text-dark-frame shadow-md shadow-brand/20'
                        : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ── TAB 1: TEXT & PLACEMENTS (ALL TEXT EDITABLE + DRAGGABLE) ──── */}
              {activeTab === 'text' && (
                <div className="space-y-6 max-w-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-bold text-base flex items-center gap-2">
                        <Move className="w-4.5 h-4.5 text-brand" />
                        <span>All Text Overlays (Draggable &amp; Editable)</span>
                      </h3>
                      <p className="text-xs text-stone-400 mt-1">
                        Drag any text box directly on the video player on the left to reposition it!
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {overlays.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setOverlays([]);
                            setSelectedOverlayId(null);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-stone-400" />
                          <span>Clear All Text</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={addOverlay}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand/15 hover:bg-brand/25 border border-brand/30 text-brand text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Text</span>
                      </button>
                    </div>
                  </div>

                  {/* Overlays List */}
                  {overlays.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#141722] border border-stone-800 text-center space-y-3">
                      <p className="text-sm font-semibold text-stone-300">Zero text overlays active</p>
                      <p className="text-xs text-stone-500 max-w-sm mx-auto">
                        Your exported video will be completely clean with no burned-in text. Click &quot;Add Text&quot; if you want custom text labels.
                      </p>
                      <button
                        type="button"
                        onClick={addOverlay}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-dark-frame text-xs font-bold transition-colors cursor-pointer shadow-md shadow-brand/20"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Text Label</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                    {overlays.map((ov, idx) => {
                      const isSelected = selectedOverlayId === ov.id;
                      return (
                        <div
                          key={ov.id}
                          onClick={() => setSelectedOverlayId(ov.id)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#151928] border-brand shadow-lg shadow-brand/10'
                              : 'bg-[#141722] border-stone-800 hover:border-stone-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
                              <Move className="w-3.5 h-3.5" />
                              Element #{idx + 1} Position: ({ov.xPercent}%, {ov.yPercent}%)
                            </span>
                            {overlays.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteOverlay(ov.id);
                                }}
                                className="text-stone-500 hover:text-red-400 p-1 transition-colors"
                                title="Remove Element"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Text input */}
                          <input
                            type="text"
                            value={ov.text}
                            onChange={(e) => updateOverlay(ov.id, { text: e.target.value })}
                            placeholder="Enter text (clean, no emojis)..."
                            className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2.5 text-white text-sm font-semibold focus:outline-none focus:border-brand"
                          />

                          {/* Color and Size Controls */}
                          {isSelected && (
                            <div className="mt-3 pt-3 border-t border-stone-800/80 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-stone-400 uppercase font-bold mr-1">
                                  Color:
                                </span>
                                {[
                                  { id: 'yellow', bg: 'bg-yellow-400' },
                                  { id: 'white', bg: 'bg-white' },
                                  { id: 'cyan', bg: 'bg-cyan-400' },
                                  { id: 'lime', bg: 'bg-lime-400' },
                                  { id: 'red', bg: 'bg-red-400' },
                                ].map((c) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => updateOverlay(ov.id, { fontColor: c.id })}
                                    className={`w-5 h-5 rounded-full ${c.bg} transition-transform ${
                                      ov.fontColor === c.id ? 'scale-125 ring-2 ring-brand' : ''
                                    }`}
                                  />
                                ))}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateOverlay(ov.id, { bgColor: 'none' })}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                    ov.bgColor === 'none'
                                      ? 'bg-brand text-dark-frame'
                                      : 'bg-stone-800 text-stone-400 hover:text-white'
                                  }`}
                                >
                                  No Border
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateOverlay(ov.id, { bgColor: 'black@0.75' })}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                    ov.bgColor !== 'none'
                                      ? 'bg-brand text-dark-frame'
                                      : 'bg-stone-800 text-stone-400 hover:text-white'
                                  }`}
                                >
                                  Dark Box
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-stone-400 uppercase font-bold">
                                  Size:
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateOverlay(ov.id, {
                                      fontSize: Math.max(20, (ov.fontSize || 38) - 4),
                                    })
                                  }
                                  className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs"
                                >
                                  -
                                </button>
                                <span className="text-xs font-mono font-bold text-brand">
                                  {ov.fontSize || 38}px
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateOverlay(ov.id, {
                                      fontSize: Math.min(72, (ov.fontSize || 38) + 4),
                                    })
                                  }
                                  className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              )}

              {/* ── TAB: LOGO & BRANDING (CAMPAIGN WATERMARK) ────────────────── */}
              {activeTab === 'branding' && (
                <div className="space-y-6 max-w-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-bold text-base flex items-center gap-2">
                        <Award className="w-4.5 h-4.5 text-brand" />
                        <span>Brand &amp; Sponsor Logo Watermark</span>
                      </h3>
                      <p className="text-xs text-stone-400 mt-1">
                        Add or reposition a brand logo for this clip. Changes appear live on the video canvas on the left!
                      </p>
                    </div>
                    {logoOverlay && (
                      <button
                        type="button"
                        onClick={() => setLogoOverlay(null)}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Logo
                      </button>
                    )}
                  </div>

                  {/* Logo Upload Card */}
                  <div className="p-4 rounded-2xl bg-[#141722] border border-stone-800 space-y-4">
                    <span className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                      1. Brand Logo File
                    </span>

                    {!logoOverlay?.url && !logoOverlay?.path ? (
                      <div className="border-2 border-dashed border-brand/40 hover:border-brand rounded-xl p-6 text-center bg-[#0a0d14] relative transition-colors cursor-pointer group">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleUploadLogoFile(e.target.files[0]);
                          }}
                          disabled={isUploadingLogo}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand group-hover:scale-105 transition-transform">
                            {isUploadingLogo ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <ImageIcon className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">
                              {isUploadingLogo ? 'Uploading logo...' : 'Click or drop logo image here'}
                            </p>
                            <p className="text-[11px] text-stone-400 mt-0.5">
                              PNG with transparent background looks cleanest
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-brand/40 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-black/60 border border-white/10 p-1 flex items-center justify-center overflow-hidden">
                            <img
                              src={
                                logoOverlay.url ||
                                (logoOverlay.path
                                  ? `/api/logos/${logoOverlay.path.split('/').pop()}`
                                  : '')
                              }
                              alt="Logo"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white line-clamp-1">
                              {logoOverlay.name || 'Brand Logo'}
                            </p>
                            <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 font-semibold">
                              <Check className="w-3 h-3" /> Positioned at {logoOverlay.position}
                            </p>
                          </div>
                        </div>
                        <label className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-stone-200 border border-white/[0.1] cursor-pointer transition-colors">
                          Change
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleUploadLogoFile(e.target.files[0]);
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Position Selector */}
                  {logoOverlay && (
                    <div className="p-4 rounded-2xl bg-[#141722] border border-stone-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                          2. Screen Placement
                        </span>
                        <span className="text-[11px] font-mono text-brand font-bold uppercase">
                          {logoOverlay.position}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { id: 'bottom-left' as LogoPosition, label: 'Bottom Left', badge: 'Recommended' },
                          { id: 'bottom-right' as LogoPosition, label: 'Bottom Right' },
                          { id: 'top-left' as LogoPosition, label: 'Top Left' },
                          { id: 'top-right' as LogoPosition, label: 'Top Right' },
                          { id: 'top-center' as LogoPosition, label: 'Top Center' },
                          { id: 'bottom-center' as LogoPosition, label: 'Bottom Center' },
                          { id: 'center' as LogoPosition, label: 'Center Watermark' },
                          { id: 'custom' as LogoPosition, label: 'Custom Pinpoint' },
                        ].map((pos) => {
                          const isPicked = logoOverlay.position === pos.id;
                          return (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() =>
                                setLogoOverlay((prev) => (prev ? { ...prev, position: pos.id } : null))
                              }
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isPicked
                                  ? 'bg-brand/20 border-brand text-white shadow-md shadow-brand/10'
                                  : 'bg-[#0a0d14] border-stone-800 text-stone-400 hover:border-stone-700'
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
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Sliders */}
                      {logoOverlay.position === 'custom' && (
                        <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-white/[0.08] space-y-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-stone-400">Horizontal Coordinate (X%):</span>
                              <span className="font-mono text-brand font-bold">{logoOverlay.xPercent ?? 6}%</span>
                            </div>
                            <input
                              type="range"
                              min="2"
                              max="95"
                              value={logoOverlay.xPercent ?? 6}
                              onChange={(e) =>
                                setLogoOverlay((prev) =>
                                  prev ? { ...prev, xPercent: Number(e.target.value) } : null
                                )
                              }
                              className="w-full accent-brand cursor-pointer"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-stone-400">Vertical Coordinate (Y%):</span>
                              <span className="font-mono text-brand font-bold">{logoOverlay.yPercent ?? 88}%</span>
                            </div>
                            <input
                              type="range"
                              min="2"
                              max="95"
                              value={logoOverlay.yPercent ?? 88}
                              onChange={(e) =>
                                setLogoOverlay((prev) =>
                                  prev ? { ...prev, yPercent: Number(e.target.value) } : null
                                )
                              }
                              className="w-full accent-brand cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Size & Opacity Controls */}
                  {logoOverlay && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Logo Width */}
                      <div className="p-4 rounded-2xl bg-[#141722] border border-stone-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                            Logo Width
                          </span>
                          <span className="text-xs font-mono font-bold text-brand">
                            {logoOverlay.widthPercent || 18}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="8"
                          max="40"
                          value={logoOverlay.widthPercent || 18}
                          onChange={(e) =>
                            setLogoOverlay((prev) =>
                              prev ? { ...prev, widthPercent: Number(e.target.value) } : null
                            )
                          }
                          className="w-full accent-brand cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                          <span>Compact (12%)</span>
                          <span>Standard (18%)</span>
                          <span>Large (30%)</span>
                        </div>
                      </div>

                      {/* Opacity */}
                      <div className="p-4 rounded-2xl bg-[#141722] border border-stone-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                            Watermark Opacity
                          </span>
                          <span className="text-xs font-mono font-bold text-brand">
                            {Math.round((logoOverlay.opacity ?? 1.0) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="20"
                          max="100"
                          step="5"
                          value={Math.round((logoOverlay.opacity ?? 1.0) * 100)}
                          onChange={(e) =>
                            setLogoOverlay((prev) =>
                              prev ? { ...prev, opacity: Number(e.target.value) / 100 } : null
                            )
                          }
                          className="w-full accent-brand cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                          <span>Ghosted (40%)</span>
                          <span>Subtle (85%)</span>
                          <span>Solid (100%)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: TRIM & TIMING ──────────────────────────────────────── */}
              {activeTab === 'trim' && (
                <div className="space-y-6 max-w-xl">
                  <div>
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                      <Scissors className="w-4.5 h-4.5 text-brand" />
                      <span>Trim Video Start &amp; End</span>
                    </h3>
                    <p className="text-xs text-stone-400 mt-1">
                      Cut out awkward pauses, stream intros, or dead air from the boundaries.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-[#141722] border border-stone-800 space-y-3">
                      <span className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                        Cut from Start
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTrimStart((v) => Math.max(0, Number((v - 0.5).toFixed(1))))}
                          className="w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-sm cursor-pointer"
                        >
                          -
                        </button>
                        <div className="flex-1 text-center font-mono text-base font-bold text-brand bg-stone-900/80 py-1.5 rounded-xl border border-stone-800">
                          {trimStart.toFixed(1)}s
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setTrimStart((v) =>
                              Math.min(videoDuration - trimEnd - 3, Number((v + 0.5).toFixed(1)))
                            )
                          }
                          className="w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-sm cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#141722] border border-stone-800 space-y-3">
                      <span className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                        Cut from End
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTrimEnd((v) => Math.max(0, Number((v - 0.5).toFixed(1))))}
                          className="w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-sm cursor-pointer"
                        >
                          -
                        </button>
                        <div className="flex-1 text-center font-mono text-base font-bold text-brand bg-stone-900/80 py-1.5 rounded-xl border border-stone-800">
                          {trimEnd.toFixed(1)}s
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setTrimEnd((v) =>
                              Math.min(videoDuration - trimStart - 3, Number((v + 0.5).toFixed(1)))
                            )
                          }
                          className="w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-sm cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                      Quick Trim Presets
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyTrimPreset('all')}
                        className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-medium text-stone-200 cursor-pointer"
                      >
                        Keep Full Clip
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTrimPreset('first15')}
                        className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-medium text-stone-200 cursor-pointer"
                      >
                        First 15s (Short &amp; Punchy)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTrimPreset('first30')}
                        className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-medium text-stone-200 cursor-pointer"
                      >
                        First 30s (TikTok Sweetspot)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTrimPreset('cut5start')}
                        className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-medium text-stone-200 cursor-pointer"
                      >
                        Skip 5s Intro
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 3: FRAMING & CROP ─────────────────────────────────────── */}
              {activeTab === 'crop' && (
                <div className="space-y-6 max-w-xl">
                  <div>
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                      <Crop className="w-4.5 h-4.5 text-brand" />
                      <span>9:16 Vertical Video Re-Framing</span>
                    </h3>
                    <p className="text-xs text-stone-400 mt-1">
                      Choose how your video is mapped onto the vertical mobile screen.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'blurred-fill' as const,
                        label: 'Blurred Fill',
                        desc: 'Full 16:9 gameplay visible with ambient background blur.',
                        tag: 'Full View',
                      },
                      {
                        id: 'center-crop' as const,
                        label: '9:13 Action View',
                        desc: 'Wide 9:13 action crop preserving 75%+ of gameplay field & HUD.',
                        tag: 'Wide Crop',
                      },
                      {
                        id: 'fit' as const,
                        label: 'Cinema Fit',
                        desc: 'Entire video scaled without crop, top/bottom black bars.',
                        tag: 'Full Context',
                      },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLayout(opt.id)}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                          layout === opt.id
                            ? 'bg-brand/10 border-brand shadow-lg shadow-brand/10'
                            : 'bg-[#141722] border-stone-800 hover:border-stone-700 text-stone-400'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-brand uppercase tracking-wider block mb-1">
                          {opt.tag}
                        </span>
                        <h4 className="text-sm font-bold text-white mb-1">{opt.label}</h4>
                        <p className="text-xs text-stone-400 leading-relaxed">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TAB 4: SUBTITLES & STYLE ─────────────────────────────────── */}
              {activeTab === 'subtitles' && (
                <div className="space-y-6 max-w-xl">
                  <div>
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                      <Type className="w-4.5 h-4.5 text-brand" />
                      <span>Subtitle Typography &amp; Placement</span>
                    </h3>
                    <p className="text-xs text-stone-400 mt-1">
                      Drag the dashed Subtitles Zone on the left video canvas, or use the controls below.
                    </p>
                  </div>

                  {/* Font Size */}
                  <div className="p-4 rounded-2xl bg-[#141722] border border-stone-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                        Caption Font Size
                      </span>
                      <span className="text-xs font-bold text-brand font-mono">
                        {Math.round(fontMultiplier * 100)}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0.6}
                      max={2.0}
                      step={0.1}
                      value={fontMultiplier}
                      onChange={(e) => setFontMultiplier(Number(e.target.value))}
                      className="w-full accent-brand cursor-pointer"
                    />

                    <div className="flex gap-2 pt-1">
                      {[
                        { label: 'Small', mult: 0.8 },
                        { label: 'Normal', mult: 1.0 },
                        { label: 'Large', mult: 1.3 },
                        { label: 'Hype', mult: 1.7 },
                      ].map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => setFontMultiplier(s.mult)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            fontMultiplier === s.mult
                              ? 'bg-brand text-dark-frame'
                              : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vertical Position */}
                  <div className="p-4 rounded-2xl bg-[#141722] border border-stone-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                        Vertical Subtitle Position ({Math.round(subtitleY * 100)}%)
                      </span>
                      <span className="text-xs font-bold text-stone-400">
                        {subtitleY < 0.35 ? 'Top Hook' : subtitleY < 0.65 ? 'Center' : 'Bottom (Shorts)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSubtitleY(0.25)}
                        className={`p-3 rounded-xl border text-center transition-colors cursor-pointer ${
                          subtitleY === 0.25
                            ? 'bg-brand/15 border-brand text-brand'
                            : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:text-white'
                        }`}
                      >
                        <AlignVerticalJustifyStart className="w-4 h-4 mx-auto mb-1" />
                        <span className="text-xs font-bold block">Top</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubtitleY(0.5)}
                        className={`p-3 rounded-xl border text-center transition-colors cursor-pointer ${
                          subtitleY === 0.5
                            ? 'bg-brand/15 border-brand text-brand'
                            : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:text-white'
                        }`}
                      >
                        <AlignVerticalJustifyCenter className="w-4 h-4 mx-auto mb-1" />
                        <span className="text-xs font-bold block">Center</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubtitleY(0.8)}
                        className={`p-3 rounded-xl border text-center transition-colors cursor-pointer ${
                          subtitleY === 0.8
                            ? 'bg-brand/15 border-brand text-brand'
                            : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:text-white'
                        }`}
                      >
                        <AlignVerticalJustifyEnd className="w-4 h-4 mx-auto mb-1" />
                        <span className="text-xs font-bold block">Bottom</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Bottom Action Bar ─────────────────────────────────────────── */}
            <div className="p-4 px-6 border-t border-stone-800/80 bg-[#12151e] flex flex-col sm:flex-row items-center justify-between gap-4 flex-shrink-0">
              <div className="flex-1">
                {errorMsg ? (
                  <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                ) : processStatus ? (
                  <div className="flex items-center gap-2 text-brand text-xs font-medium">
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    )}
                    <span>{processStatus}</span>
                  </div>
                ) : (
                  <p className="text-xs text-stone-400">
                    Drag text on the video player or edit values above, then click Re-Export.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {lastSavedClip && (
                  <a
                    href={lastSavedClip.publicUrl}
                    download
                    className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Edited MP4</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleApplyAndRerender}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-50 text-dark-frame font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand/20 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Re-Rendering Clip...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Apply Edits &amp; Re-Export</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
