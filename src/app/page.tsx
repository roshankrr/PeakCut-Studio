'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import TemplatePicker from '@/components/TemplatePicker';
import UrlInputForm from '@/components/UrlInputForm';
import ProgressStepper from '@/components/ProgressStepper';
import ClipCard from '@/components/ClipCard';
import SettingsModal from '@/components/SettingsModal';
import LearningModal from '@/components/LearningModal';
import StreamStepperPanel from '@/components/StreamStepperPanel';
import { Job, CaptionStyle, FrameLayout, TemplateId } from '@/lib/types';
import { Sparkles, Flame, Film, Trash2, Cpu, Zap, Eye, Sliders, Loader2, Plus, MessageSquare } from 'lucide-react';

export default function HomePage() {
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLearningOpen, setIsLearningOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [template, setTemplate] = useState<TemplateId>('viral-clipper');
  const [discoveringMoreId, setDiscoveringMoreId] = useState<string | null>(null);
  const [partFilter, setPartFilter] = useState<number | null>(null);

  useEffect(() => {
    checkSettings();
    loadRecentJobs();
  }, []);

  function checkSettings() {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setHasApiKey(Boolean(data.hasGroqKey || data.hasGeminiKey)))
      .catch(console.error);
  }

  function loadRecentJobs() {
    fetch('/api/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.jobs && Array.isArray(data.jobs)) {
          setRecentJobs(data.jobs);
          if (
            data.jobs[0] &&
            data.jobs[0].status !== 'completed' &&
            data.jobs[0].status !== 'failed'
          ) {
            setActiveJob(data.jobs[0]);
          }
        }
      })
      .catch(console.error);
  }

  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const interval = setInterval(() => {
      fetch(`/api/status?jobId=${activeJob.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.job) {
            setActiveJob(data.job);
            if (data.job.status === 'completed' || data.job.status === 'failed') {
              loadRecentJobs();
            }
          }
        })
        .catch(console.error);
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJob]);

  async function handleStartUrl(
    url: string,
    captionStyle: CaptionStyle,
    frameLayout: FrameLayout,
    clipCount: number = 3,
    userPrompt?: string
  ) {
    if (!hasApiKey) {
      setIsSettingsOpen(true);
      return;
    }
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          captionStyle,
          frameLayout,
          clipCount,
          userPrompt: userPrompt?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.job) setActiveJob(data.job);
      else if (data.error) alert(data.error);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start job';
      alert(msg);
    }
  }

  async function handleStartFile(
    file: File,
    captionStyle: CaptionStyle,
    frameLayout: FrameLayout,
    clipCount: number = 3,
    userPrompt?: string
  ) {
    if (!hasApiKey) {
      setIsSettingsOpen(true);
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('captionStyle', captionStyle);
      formData.append('frameLayout', frameLayout);
      formData.append('clipCount', String(clipCount));
      if (userPrompt?.trim()) {
        formData.append('userPrompt', userPrompt.trim());
      }
      const res = await fetch('/api/process', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.job) setActiveJob(data.job);
      else if (data.error) alert(data.error);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start file upload';
      alert(msg);
    }
  }

  async function handleDiscoverMoreClips(jobId: string) {
    setDiscoveringMoreId(jobId);
    try {
      const res = await fetch('/api/clips/more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, count: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start discovering more clips');

      if (data.job) {
        setActiveJob(data.job);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setDiscoveringMoreId(null);
    }
  }

  async function handleDeleteJob(jobId: string) {
    if (!window.confirm('Delete this video and its rendered clips from local storage?')) return;
    try {
      const res = await fetch(`/api/storage?jobId=${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        setRecentJobs((prev) => prev.filter((j) => j.id !== jobId));
        if (activeJob?.id === jobId) setActiveJob(null);
      }
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
  }

  const isProcessing = Boolean(
    activeJob && activeJob.status !== 'completed' && activeJob.status !== 'failed'
  );

  return (
    <div className="min-h-screen bg-[#080A0F] text-stone-100 flex flex-col font-sans selection:bg-brand selection:text-black">
      <Navbar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenLearning={() => setIsLearningOpen(true)}
        hasApiKey={hasApiKey}
        onStorageCleared={() => {
          setActiveJob(null);
          setRecentJobs([]);
        }}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        {/* ── Hero Section ─────────────────────────────────────────────── */}
        <section className="relative text-center max-w-3xl mx-auto space-y-5 ambient-hero-glow pt-4 pb-2">
          {/* Status pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-stone-300">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            <span>High-Retention Vertical Video Studio</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12]">
            Turn streams and VODs into{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-orange-400 to-amber-300">
              vertical shorts.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-stone-400 max-w-2xl mx-auto leading-relaxed">
            AI identifies audience replay peaks, crops to 9:16 vertical video, generates word-timed
            subtitles, and stages multi-format comparisons. Fully local and free.
          </p>

          {/* Feature Badges Strip */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-stone-400">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <Eye className="w-3 h-3 text-brand" /> Heatmap Peak Finder
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <Zap className="w-3 h-3 text-brand" /> Word-Level Captions
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <Cpu className="w-3 h-3 text-brand" /> Zero Cloud Costs
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <Sliders className="w-3 h-3 text-brand" /> Non-Destructive Re-render
            </span>
          </div>
        </section>

        {/* ── Studio Console Panel ─────────────────────────────────────── */}
        <section className="bg-[#0E1118] border border-white/[0.08] rounded-2xl p-5 sm:p-7 shadow-2xl space-y-6">
          {/* Template Picker */}
          <TemplatePicker selected={template} onChange={setTemplate} />

          <div className="h-px bg-white/[0.06]" />

          {/* Input Form — adapts to selected template */}
          <UrlInputForm
            onSubmitUrl={handleStartUrl}
            onSubmitFile={handleStartFile}
            onJobCreated={(job) => {
              setActiveJob(job);
              loadRecentJobs();
            }}
            disabled={isProcessing}
            templateId={template}
          />
        </section>

        {/* ── Progress Stepper ─────────────────────────────────────────── */}
        {activeJob && (
          <section className="bg-[#0E1118] border border-white/[0.08] rounded-2xl p-6 shadow-xl">
            <ProgressStepper
              status={activeJob.status}
              progress={activeJob.progress}
              statusMessage={activeJob.statusMessage}
              error={activeJob.error}
            />
          </section>
        )}

        {/* ── Stream Stepper Controller (Chunk-by-Chunk 4–6h Mode) ───────── */}
        {activeJob && (activeJob.templateId === 'stream-stepper' || activeJob.stepper) && (
          <StreamStepperPanel
            job={activeJob}
            onJobUpdated={(j) => setActiveJob(j)}
            selectedPartFilter={partFilter}
            onSelectPartFilter={setPartFilter}
          />
        )}

        {/* ── Active Job Clips ─────────────────────────────────────────── */}
        {activeJob && activeJob.status === 'completed' && activeJob.clips.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand" />
                  <span>
                    Ready Clips ({partFilter ? `${activeJob.clips.filter((c) => (c.partNumber || 1) === partFilter).length} in Part ${partFilter}` : activeJob.clips.length})
                  </span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Reframed to 9:16 with animated subtitles &amp; hook headlines. Ready for TikTok, Reels &amp; Shorts.
                </p>
                {activeJob.userPrompt && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand/10 border border-brand/25 text-brand text-xs font-medium">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span>Cutout topic: &ldquo;{activeJob.userPrompt}&rdquo;</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                {!activeJob.stepper && (
                  <button
                    type="button"
                    onClick={() => handleDiscoverMoreClips(activeJob.id)}
                    disabled={Boolean(discoveringMoreId) || isProcessing}
                    title="Extract 3 additional non-overlapping moments from the stream with secondary virality scores"
                    className="btn-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm cursor-pointer disabled:opacity-40"
                  >
                    {discoveringMoreId === activeJob.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Discovering Moments...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Get More Clips (+3 Next Moments)</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => handleDeleteJob(activeJob.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.08] transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Video</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {(partFilter
                ? activeJob.clips.filter((c) => (c.partNumber || 1) === partFilter)
                : activeJob.clips
              ).map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  jobId={activeJob.id}
                  sourceTitle={activeJob.title}
                  sourceUrl={activeJob.sourceUrl}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Clip Library ─────────────────────────────────────────────── */}
        {recentJobs.length > 0 && (!activeJob || activeJob.status === 'completed') && (
          <section className="pt-8 border-t border-white/[0.08] space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-stone-400" />
                <span>Local Clip Library</span>
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Saved locally on your machine. No cloud storage limits.
              </p>
            </div>

            {recentJobs
              .filter((j) => j.clips && j.clips.length > 0)
              .map((job) => (
                <div
                  key={job.id}
                  className="space-y-4 bg-[#0E1118]/60 border border-white/[0.08] rounded-2xl p-5"
                >
                  <div className="flex items-center justify-between text-xs text-stone-400 pb-3 border-b border-white/[0.06]">
                    <div>
                      <span className="font-semibold text-stone-200 text-sm">
                        {job.title || job.sourceUrl || job.inputFilename}
                      </span>
                      <span className="ml-3 text-stone-500 font-mono text-[11px]">
                        {new Date(job.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDiscoverMoreClips(job.id)}
                        disabled={Boolean(discoveringMoreId) || isProcessing}
                        title="Extract 3 additional non-overlapping moments"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand transition-all cursor-pointer disabled:opacity-40"
                      >
                        {discoveringMoreId === job.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Discovering...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Get More Clips (+3)</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.08] transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Video &amp; Storage</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {job.clips.map((clip) => (
                      <ClipCard
                        key={clip.id}
                        clip={clip}
                        jobId={job.id}
                        sourceTitle={job.title}
                        sourceUrl={job.sourceUrl}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </section>
        )}
      </main>

      <footer className="border-t border-white/[0.08] py-8 text-center text-xs text-stone-500">
        <p>PeakCut Studio · 100% Free &amp; Open Source · Local Processing Engine</p>
      </footer>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={checkSettings}
      />

      <LearningModal
        isOpen={isLearningOpen}
        onClose={() => setIsLearningOpen(false)}
      />
    </div>
  );
}
