'use client';

import React, { useState } from 'react';
import {
  FastForward,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  ChevronRight,
  Layers,
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Job, StreamStepperState } from '@/lib/types';

function formatSecondsToTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface StreamStepperPanelProps {
  job: Job;
  onJobUpdated?: (updatedJob: Job) => void;
  selectedPartFilter: number | null;
  onSelectPartFilter: (partNumber: number | null) => void;
}

export default function StreamStepperPanel({
  job,
  onJobUpdated,
  selectedPartFilter,
  onSelectPartFilter,
}: StreamStepperPanelProps) {
  const stepper: StreamStepperState | undefined = job.stepper;
  const [loadingNext, setLoadingNext] = useState(false);
  const [nextPrompt, setNextPrompt] = useState('');
  const [showNextPromptInput, setShowNextPromptInput] = useState(false);
  const [error, setError] = useState('');

  if (!stepper) return null;

  const isJobProcessing = job.status !== 'completed' && job.status !== 'failed';
  const hasNextPart = stepper.currentChunkIndex < stepper.totalChunks - 1;
  const nextChunkIndex = stepper.currentChunkIndex + 1;
  const nextStartTime = nextChunkIndex * stepper.chunkDuration;
  const nextEndTime = Math.min(stepper.totalDuration, nextStartTime + stepper.chunkDuration);

  // Group existing clips by part
  const partMap = new Map<number, number>();
  (job.clips || []).forEach((c) => {
    const p = c.partNumber || 1;
    partMap.set(p, (partMap.get(p) || 0) + 1);
  });

  async function handleAdvancePart(targetIndex?: number) {
    const idx = typeof targetIndex === 'number' ? targetIndex : nextChunkIndex;
    if (idx >= stepper!.totalChunks) return;

    setLoadingNext(true);
    setError('');

    try {
      const res = await fetch('/api/stepper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'next',
          jobId: job.id,
          targetChunkIndex: idx,
          userPrompt: nextPrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to advance stream stepper');

      setNextPrompt('');
      setShowNextPromptInput(false);
      if (data.job && onJobUpdated) {
        onJobUpdated(data.job);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingNext(false);
    }
  }

  return (
    <div className="bg-[#0E1118] border border-brand/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-6">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand shadow-lg shadow-brand/10">
            <FastForward className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-base tracking-tight">Stream Stepper Controller</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand/20 text-brand border border-brand/30">
                Chunk Mode
              </span>
            </div>
            <p className="text-stone-400 text-xs mt-0.5">
              Total VOD: <span className="font-mono text-white font-semibold">{formatSecondsToTime(stepper.totalDuration)}</span> · {stepper.totalChunks} Total Parts ({Math.round(stepper.chunkDuration / 60)} min each)
            </p>
          </div>
        </div>

        {/* Current status pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141824] border border-white/[0.08] text-xs">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="text-stone-400">Current Position:</span>
          <span className="text-white font-bold font-mono">
            Part {stepper.currentChunkIndex + 1}/{stepper.totalChunks} [{formatSecondsToTime(stepper.chunkStartTime)} - {formatSecondsToTime(stepper.chunkEndTime)}]
          </span>
        </div>
      </div>

      {/* Interactive Chunk Navigation Scrubber */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-stone-300 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-brand" />
            <span>VOD Parts Stepper ({stepper.completedChunks.length}/{stepper.totalChunks} Completed)</span>
          </span>
          <span className="text-[11px] text-stone-500 font-mono">
            {job.clips.length} Clips Harvested So Far
          </span>
        </div>

        {/* Chunks timeline track */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          {Array.from({ length: stepper.totalChunks }).map((_, idx) => {
            const partNum = idx + 1;
            const isCompleted = stepper.completedChunks.includes(idx);
            const isCurrent = stepper.currentChunkIndex === idx;
            const startSec = idx * stepper.chunkDuration;
            const endSec = Math.min(stepper.totalDuration, startSec + stepper.chunkDuration);
            const clipCountForPart = partMap.get(partNum) || 0;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (!isJobProcessing && (!isCurrent || job.status === 'failed')) {
                    handleAdvancePart(idx);
                  }
                }}
                disabled={isJobProcessing || (isCurrent && job.status !== 'failed')}
                title={`Part ${partNum}: ${formatSecondsToTime(startSec)} - ${formatSecondsToTime(endSec)} (${clipCountForPart} clips)`}
                className={`flex-shrink-0 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                  isCurrent
                    ? job.status === 'failed'
                      ? 'bg-rose-500/20 border-rose-500/60 text-white shadow-md shadow-rose-500/10 hover:border-rose-400'
                      : 'bg-brand/20 border-brand text-white shadow-md shadow-brand/20'
                    : isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/50'
                    : 'bg-[#141824] border-white/[0.08] text-stone-400 hover:border-white/[0.18]'
                } disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-1.5">
                  {isCompleted ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : isCurrent ? (
                    job.status === 'failed' ? (
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-brand animate-ping" />
                    )
                  ) : (
                    <Clock className="w-3 h-3 text-stone-500" />
                  )}
                  <span className="text-xs font-bold font-mono">Part {partNum}</span>
                </div>
                <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                  {formatSecondsToTime(startSec)}
                </p>
                {clipCountForPart > 0 && (
                  <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/[0.06] text-stone-300">
                    {clipCountForPart} clips
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Failed Part Recovery Banner */}
      {job.status === 'failed' && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-rose-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <div>
              <p className="font-bold text-white">
                Part {stepper.currentChunkIndex + 1} Interrupted
              </p>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Previously harvested clips are safe. With IPv4 and network retries active, you can retry Part {stepper.currentChunkIndex + 1} or continue to the next part.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleAdvancePart(stepper.currentChunkIndex)}
            disabled={loadingNext || isJobProcessing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-40 flex-shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingNext ? 'animate-spin' : ''}`} />
            <span>Retry Part {stepper.currentChunkIndex + 1}</span>
          </button>
        </div>
      )}

      {/* Next Part Action Callout */}
      {hasNextPart ? (
        <div className="p-4 rounded-xl bg-gradient-to-r from-brand/10 via-[#141824] to-[#141824] border border-brand/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Next Chunk Ready
                </span>
                <span className="text-xs text-white font-semibold">
                  Part {nextChunkIndex + 1} of {stepper.totalChunks}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Window: <span className="font-mono text-stone-200">{formatSecondsToTime(nextStartTime)} to {formatSecondsToTime(nextEndTime)}</span> (~{Math.round(stepper.chunkDuration / 60)} minutes). Downloads only ~5MB of speech audio without full video re-download!
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNextPromptInput(!showNextPromptInput)}
                className="text-[11px] text-stone-400 hover:text-stone-200 underline underline-offset-4 cursor-pointer"
              >
                {showNextPromptInput ? 'Hide Topic Focus' : '+ Add Topic Focus for this Part'}
              </button>

              <button
                type="button"
                onClick={() => handleAdvancePart()}
                disabled={isJobProcessing || loadingNext}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-brand/20 cursor-pointer disabled:opacity-40"
              >
                {loadingNext || isJobProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Part {nextChunkIndex + 1}...</span>
                  </>
                ) : (
                  <>
                    <FastForward className="w-4 h-4" />
                    <span>Clip Next Part ({formatSecondsToTime(nextStartTime)} - {formatSecondsToTime(nextEndTime)})</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Optional Topic Prompt for next part */}
          {showNextPromptInput && (
            <div className="pt-2 border-t border-white/[0.08] flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-brand flex-shrink-0" />
              <input
                type="text"
                value={nextPrompt}
                onChange={(e) => setNextPrompt(e.target.value)}
                placeholder={`Specific scene for Part ${nextChunkIndex + 1}? e.g. "when they react to the boss", "the debate at the end"...`}
                className="flex-1 bg-[#080A0F] border border-white/[0.08] focus:border-brand/60 focus:ring-1 focus:ring-brand/30 rounded-lg px-3 py-1.5 text-white placeholder-stone-500 text-xs transition-colors"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete Stream Fully Processed! All {stepper.totalChunks} parts have been clipped.</span>
          </div>
          <span className="font-mono text-stone-300 font-bold">{job.clips.length} Total Shorts Created</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Part Filter Pills */}
      {partMap.size > 1 && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-white/[0.06] text-xs">
          <span className="text-stone-400 font-medium text-[11px] mr-1">Filter Clips:</span>
          <button
            type="button"
            onClick={() => onSelectPartFilter(null)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              selectedPartFilter === null
                ? 'bg-brand text-[#080A0F]'
                : 'bg-[#141824] text-stone-400 hover:text-white border border-white/[0.08]'
            }`}
          >
            All Parts ({job.clips.length})
          </button>
          {Array.from(partMap.keys())
            .sort((a, b) => a - b)
            .map((partNum) => (
              <button
                key={partNum}
                type="button"
                onClick={() => onSelectPartFilter(partNum)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedPartFilter === partNum
                    ? 'bg-brand text-[#080A0F]'
                    : 'bg-[#141824] text-stone-400 hover:text-white border border-white/[0.08]'
                }`}
              >
                Part {partNum} ({partMap.get(partNum)})
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
