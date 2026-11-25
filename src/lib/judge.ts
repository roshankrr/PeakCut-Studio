import { getSettings } from './config';
import { TranscriptSegment, ClipMoment, HeatmapPoint } from './types';
import { AudioEnergyPoint } from './audio';
import { buildLearningPromptSection } from './learning';

export function parseTimestampFromText(text: string): number | null {
  // Matches e.g. "12:34", "1:23:45"
  const colonMatch = text.match(/\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/);
  if (colonMatch) {
    const hours = colonMatch[1] ? parseInt(colonMatch[1], 10) : 0;
    const minutes = parseInt(colonMatch[2], 10);
    const seconds = parseInt(colonMatch[3], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
  // Matches e.g. "minute 14", "min 14"
  const prefixMinMatch = text.match(/\b(?:minute|min)\s*(\d+)\b/i);
  if (prefixMinMatch) {
    return parseInt(prefixMinMatch[1], 10) * 60;
  }
  // Matches e.g. "14m", "14 min", "14 mins", "14 minute", "14 minutes"
  const minMatch = text.match(/\b(\d+)\s*(?:m|min|mins|minute|minutes)\b/i);
  if (minMatch) {
    return parseInt(minMatch[1], 10) * 60;
  }
  return null;
}

export function scoreSceneUserRelevance(
  sceneText: string,
  sceneStart: number,
  sceneEnd: number,
  userPrompt: string
): { score: number; matchedWords: string[]; confidence: 'high' | 'medium' | 'none' } {
  const normScene = sceneText.toLowerCase();
  const normPrompt = userPrompt.toLowerCase().trim();

  // Comprehensive stop words (conversational filler, common verbs, pronouns, question words)
  const stopWords = new Set([
    'please', 'pls', 'cut', 'out', 'cutout', 'that', 'this', 'the', 'scene', 'scean',
    'part', 'moment', 'video', 'sure', 'for', 'a', 'an', 'and', 'or', 'where', 'when',
    'they', 'he', 'she', 'it', 'about', 'on', 'in', 'at', 'to', 'from', 'with', 'of',
    'i', 'me', 'my', 'we', 'check', 'topics', 'topic', 'particular', 'perticular',
    'make', 'clip', 'shorts', 'short', 'want', 'look', 'tell', 'myself', 'just', 'add',
    'comment', 'comments', 'section', 'what', 'which', 'who', 'why', 'how', 'there',
    'here', 'then', 'than', 'them', 'their', 'our', 'your', 'his', 'her', 'its', 'was',
    'were', 'is', 'are', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'done', 'would', 'should', 'could', 'can', 'will', 'talk', 'talks', 'talking',
    'said', 'says', 'saying', 'went', 'goes', 'going', 'gone', 'get', 'gets', 'getting',
    'got', 'know', 'knows', 'knowing', 'think', 'thinks', 'thinking', 'like', 'really',
    'very', 'much', 'also', 'even', 'good', 'bad', 'well', 'some', 'any', 'all', 'one',
    'two', 'see', 'seen', 'saw', 'thing', 'things', 'stuff', 'guy', 'guys', 'man', 'bro'
  ]);

  // Check if timestamp is specified in prompt
  const targetTs = parseTimestampFromText(normPrompt);
  let timeScore = 0;
  if (targetTs !== null) {
    const dist = Math.abs((sceneStart + sceneEnd) / 2 - targetTs);
    if (dist <= 35) {
      timeScore = 160 - dist * 2;
    } else if (dist <= 65) {
      timeScore = 80;
    }
  }

  // Extract substantive concept words (length >= 3, not stop words)
  const words = normPrompt
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  const matchedWords: string[] = [];

  for (const word of words) {
    // Word boundary check to avoid partial word collisions
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(normScene)) {
      matchedWords.push(word);
    }
  }

  // Exact phrase matching for 2-word or 3-word combinations
  let phraseScore = 0;
  if (words.length >= 2) {
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (normScene.includes(phrase)) {
        phraseScore += 80;
      }
    }
  }

  // Direct phrase match if user entered a specific phrase / quote
  let fullPhraseScore = 0;
  const cleanedPrompt = normPrompt
    .replace(/^(please\s+|cut\s+out\s+|cut\s+|check\s+)/, '')
    .trim();
  if (cleanedPrompt.length >= 8 && normScene.includes(cleanedPrompt)) {
    fullPhraseScore += 150;
  }

  // STRICT ANTI-1-WORD MATCHING:
  // If the user provided 2 or more substantive words, but the scene matches only 1 word
  // and there is no phrase match or timestamp match: IT IS NOT A VALID MATCH (reject single-word collisions).
  let keywordScore = 0;
  if (words.length >= 2) {
    if (matchedWords.length >= 2) {
      // Calculate coverage ratio: percentage of substantive concepts present
      const coverageRatio = matchedWords.length / words.length;
      keywordScore = matchedWords.length * 35 + (coverageRatio >= 0.5 ? 50 : 0);
    } else {
      // Only 1 word matched out of 2+ words -> likely random coincidental mention!
      keywordScore = 0;
    }
  } else if (words.length === 1 && matchedWords.length === 1) {
    // Single specific keyword requested: only score if it's a specific term (length >= 5)
    if (words[0].length >= 5) {
      keywordScore = 50;
    }
  }

  const totalScore = timeScore + keywordScore + phraseScore + fullPhraseScore;

  let confidence: 'high' | 'medium' | 'none' = 'none';
  if (totalScore >= 100 || (timeScore > 0 && matchedWords.length >= 1) || phraseScore > 0 || fullPhraseScore > 0) {
    confidence = 'high';
  } else if (totalScore >= 60 && matchedWords.length >= 2) {
    confidence = 'medium';
  }

  return { score: totalScore, matchedWords, confidence };
}

export async function findPeakMoments(
  segments: TranscriptSegment[],
  energyPoints: AudioEnergyPoint[],
  totalDuration: number,
  heatmapPoints?: HeatmapPoint[],
  targetClipCount: number = 3,
  excludeRanges: { startTime: number; endTime: number }[] = [],
  includeSecondaryScores: boolean = false,
  userPrompt?: string
): Promise<ClipMoment[]> {
  const settings = getSettings();
  const groqApiKey = settings.groqApiKey || process.env.GROQ_API_KEY;
  const geminiApiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!groqApiKey && !geminiApiKey) {
    throw new Error(
      'No API key found. Please enter a free Groq or Gemini API key in Settings.'
    );
  }

  // 1. Group Transcript into Natural Narrative Scenes (~30-50s conversation blocks)
  // This preserves jokes, roasts, storytelling, setups, and punchlines together!
  interface SceneBlock {
    id: number;
    startTime: number;
    endTime: number;
    text: string;
    avgLoudness: number;
    hasAudienceReplay: boolean;
    userMatchScore?: number;
    userMatchConfidence?: 'high' | 'medium' | 'none';
    matchedKeywords?: string[];
  }

  const scenes: SceneBlock[] = [];
  const targetSceneDuration = 35; // Ideal TikTok/Shorts length
  let currentSceneSegs: TranscriptSegment[] = [];
  let sceneStart = segments.length > 0 ? segments[0].start : 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentSceneSegs.push(seg);

    const sceneDuration = seg.end - sceneStart;
    const isEndOfVideo = i === segments.length - 1;

    // When scene reaches 30-45s or pause/break
    if (sceneDuration >= targetSceneDuration || isEndOfVideo) {
      const sceneEnd = seg.end;
      const text = currentSceneSegs.map((s) => s.text.trim()).join(' ');

      // Check if this scene overlaps with previously clipped ranges
      const isAlreadyClipped = excludeRanges.some((range) => {
        const overlapStart = Math.max(sceneStart, range.startTime);
        const overlapEnd = Math.min(sceneEnd, range.endTime);
        return (overlapEnd - overlapStart) > 8; // >8s overlap
      });

      if (!isAlreadyClipped && text.length > 30) {
        // Check audio loudness as an enhancer (not a gatekeeper)
        const sceneAudio = energyPoints.filter(
          (e) => e.time >= sceneStart && e.time <= sceneEnd
        );
        const avgLoud =
          sceneAudio.length > 0
            ? sceneAudio.reduce((acc, e) => acc + e.energyScore, 0) / sceneAudio.length
            : 50;

        // Check YouTube audience heatmap replay
        let hasReplay = false;
        if (Array.isArray(heatmapPoints) && heatmapPoints.length > 0) {
          hasReplay = heatmapPoints.some(
            (h) => h.start_time >= sceneStart && h.end_time <= sceneEnd && h.value >= 0.5
          );
        }

        // Calculate relevance to user-requested scene/topic comment with semantic validation
        const relevance = userPrompt?.trim()
          ? scoreSceneUserRelevance(text, sceneStart, sceneEnd, userPrompt.trim())
          : { score: 0, matchedWords: [], confidence: 'none' as const };

        scenes.push({
          id: scenes.length + 1,
          startTime: Math.round(sceneStart * 10) / 10,
          endTime: Math.round(sceneEnd * 10) / 10,
          text,
          avgLoudness: Math.round(avgLoud),
          hasAudienceReplay: hasReplay,
          userMatchScore: relevance.score,
          userMatchConfidence: relevance.confidence,
          matchedKeywords: relevance.matchedWords,
        });
      }

      // Next scene starts
      currentSceneSegs = [];
      sceneStart = seg.end;
    }
  }

  // 2. Select diverse candidate scenes across the video to evaluate
  let candidateScenes = scenes;
  if (scenes.length > targetClipCount * 2) {
    const sortedByEngagement = [...scenes].sort((a, b) => {
      // ONLY prioritize scenes that have genuine HIGH or MEDIUM semantic confidence!
      const isHighA = a.userMatchConfidence === 'high';
      const isHighB = b.userMatchConfidence === 'high';
      if (isHighA !== isHighB) {
        return isHighA ? -1 : 1;
      }

      const isMedA = a.userMatchConfidence === 'medium';
      const isMedB = b.userMatchConfidence === 'medium';
      if (isMedA !== isMedB) {
        return isMedA ? -1 : 1;
      }

      const scoreA = (a.hasAudienceReplay ? 30 : 0) + (a.avgLoudness * 0.3) + Math.min(40, a.text.length / 5);
      const scoreB = (b.hasAudienceReplay ? 30 : 0) + (b.avgLoudness * 0.3) + Math.min(40, b.text.length / 5);
      return scoreB - scoreA;
    });

    // Inspect top candidate scenes (spread chronologically for LLM context)
    const inspectCount = Math.min(scenes.length, Math.max(6, targetClipCount * 2));
    candidateScenes = sortedByEngagement.slice(0, inspectCount).sort((a, b) => a.startTime - b.startTime);
  }

  // If no scenes left (video was exhausted), fallback to any available non-overlapping segments
  if (candidateScenes.length === 0 && segments.length > 0) {
    for (let i = 0; i < targetClipCount; i++) {
      const testStart = Math.min(totalDuration - 35, (totalDuration / (targetClipCount + 2)) * (i + 1));
      candidateScenes.push({
        id: i + 1,
        startTime: testStart,
        endTime: testStart + 35,
        text: 'Stream conversation segment',
        avgLoudness: 60,
        hasAudienceReplay: false,
      });
    }
  }

  // Format scenes for AI analysis
  const formattedScenes = candidateScenes
    .map(
      (s) =>
        `SCENE #${s.id} [${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s]${
          s.hasAudienceReplay ? ' (Audience Most Replayed)' : ''
        }${
          s.userMatchConfidence === 'high'
            ? ` (🎯 High Semantic Confidence for: "${userPrompt}")`
            : s.userMatchConfidence === 'medium'
            ? ` (🔍 Partial Keyword Match: "${s.matchedKeywords?.join(', ')}")`
            : ''
        }:
Dialogue: "${s.text}"`
    )
    .join('\n\n');

  const dynamicLearningGuidelines = buildLearningPromptSection();

  const userPromptInstruction = userPrompt?.trim()
    ? `
MANDATORY USER TOPIC / SCENE REQUEST:
The user explicitly asked to find and cut out this scene from the video:
"${userPrompt.trim()}"

CRITICAL CONTEXT VALIDATION RULES:
1. CONTEXT IS KING: Do NOT select a scene simply because it mentions a single isolated word or coincidence term. The dialogue across the scene MUST genuinely discuss, depict, or experience the topic/moment requested by the user.
2. If multiple scenes discuss it, select the one with the best narrative climax, joke, or reaction.
3. If a scene genuinely matches the user's topic, set "matchedUserPrompt": true in its JSON object, give it a top viralScore (96-99), and place it as Clip #1.
4. REJECT FALSE MATCHES: If NONE of the candidate scenes genuinely discuss the user's requested topic, set "matchedUserPrompt": false on all clips and select the best organic viral clips instead. NEVER force an irrelevant scene just to satisfy the request.
`
    : '';

  // 3. Multi-Dimensional Viral Prompt with Self-Improved Adaptive Guidelines
  const prompt = `You are the lead viral content strategist and editor for TikTok, YouTube Shorts, and Instagram Reels.
${
  includeSecondaryScores
    ? `Analyze these candidate scenes and extract ${targetClipCount} engaging secondary clips (conversational banter, funny fails, streamer reactions, or interesting stories). Assign realistic virality scores between 70 and 88.`
    : `Analyze these scenes from the video and select the TOP ${targetClipCount} most VIRAL clips.`
}
${userPromptInstruction}
${dynamicLearningGuidelines}

LOOK FOR MULTI-DIMENSIONAL VIRALITY:
1. USER REQUESTED SCENE: If the user provided a topic/scene request above and a scene genuinely matches the full context, fulfill it as the #1 priority.
2. COMEDY & HUMOR: Funny jokes, clever punchlines, sarcasm, ironic fails, witty banter, or hilarious streamer roasts.
3. INTENSE / DRAMATIC MOMENTS: Suspenseful situations, sudden plot twists, jump scares, heated arguments, or high-stakes dilemmas.
4. STORYTELLING & CURIOSITY HOOKS: Stories that grab attention in the first 3 seconds and make viewers watch till the end.
5. RELATABLE / UNEXPECTED: Moments where something shocking, bizarre, or deeply relatable happens.

CRITICAL CLIP LENGTH RULE:
- Each selected clip MUST be between 25 and 45 seconds long (a complete narrative scene with beginning, punchline/climax, and reaction).
- Output startTime and endTime matching the scene's timestamps.

Output JSON format:
{
  "moments": [
    {
      "sceneId": 1,
      "startTime": 670.0,
      "endTime": 702.0,
      "category": "Humor | Intense | Drama | Story | UserRequested",
      "viralScore": 95,
      "matchedUserPrompt": true,
      "reason": "Why this will perform well on TikTok/Shorts and how it matches user comment",
      "hook": "THE SECRET REVEALED",
      "title": "Viral Catchy Video Title",
      "description": "Engaging description for YouTube Shorts / Reels",
      "hashtags": ["#shorts", "#funny", "#viral", "#gaming"]
    }
  ]
}

SCENES:
${formattedScenes.slice(0, 8500)}
`;

  let responseText = '';
  let lastError: Error | null = null;

  const groqModels = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
  ];

  if (groqApiKey) {
    for (const model of groqModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqApiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.25,
            response_format: { type: 'json_object' },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          responseText = json.choices[0]?.message?.content || '{}';
          lastError = null;
          break;
        } else {
          const errBody = await res.text();
          console.warn(`Groq model ${model} failed (${res.status}): ${errBody.slice(0, 150)}`);
          lastError = new Error(`Groq LLM call failed: ${errBody}`);
        }
      } catch (err: any) {
        lastError = err;
      }
    }
  }

  // Fallback to Gemini if needed
  if (!responseText && geminiApiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt + '\nReturn pure JSON only.' }] }],
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        responseText = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        lastError = null;
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!responseText && lastError) {
    throw lastError;
  }

  // Parse JSON response safely
  let moments: any[] = [];
  try {
    const clean = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    moments = Array.isArray(parsed) ? parsed : parsed.moments || parsed.clips || [];
  } catch (err) {
    console.error('Failed to parse moments JSON:', responseText, err);
  }

  // Fallback directly to the top scenes if LLM returned empty
  if (!moments || moments.length === 0) {
    moments = candidateScenes.slice(0, targetClipCount).map((s, idx) => ({
      sceneId: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      category: s.userMatchConfidence === 'high' ? 'User Requested Scene' : 'Top Highlight',
      viralScore: s.userMatchConfidence === 'high' ? 98 : 88,
      matchedUserPrompt: s.userMatchConfidence === 'high',
      reason: (s.userMatchConfidence === 'high' && userPrompt?.trim())
        ? `🎯 Matched your comment: "${userPrompt.trim()}"`
        : 'Top engaging scene with dialogue and reaction',
      hook: `MUST WATCH #${idx + 1}`,
      title: (s.userMatchConfidence === 'high' && userPrompt?.trim())
        ? `Requested: ${userPrompt.trim().slice(0, 36)}`
        : `Best Highlight #${idx + 1}`,
      description: 'Check out this moment from the video!',
      hashtags: ['#shorts', '#viral', '#trending'],
    }));
  }

  // 4. Guarantee User Requested Scene Cutout ONLY IF we have a verified HIGH-CONFIDENCE semantic match
  if (userPrompt?.trim()) {
    const hasPromptMatch = moments.some((m) => m.matchedUserPrompt === true);
    // Strict threshold: never force an absurd clip with weak or 1-word similarity
    const topUserScene = scenes
      .filter((s) => s.userMatchConfidence === 'high')
      .sort((a, b) => (b.userMatchScore || 0) - (a.userMatchScore || 0))[0];

    if (!hasPromptMatch && topUserScene) {
      // Check if one of the returned moments overlaps with topUserScene
      const overlappingIdx = moments.findIndex((m) => {
        const start = Number(m.startTime);
        const end = Number(m.endTime);
        const overlapStart = Math.max(start, topUserScene.startTime);
        const overlapEnd = Math.min(end, topUserScene.endTime);
        return (overlapEnd - overlapStart) > 10;
      });

      if (overlappingIdx !== -1) {
        moments[overlappingIdx].matchedUserPrompt = true;
        moments[overlappingIdx].viralScore = Math.max(96, Number(moments[overlappingIdx].viralScore || 0));
        moments[overlappingIdx].reason = `🎯 Matched your comment: "${userPrompt.trim()}"`;
        // Move to first position
        const [matched] = moments.splice(overlappingIdx, 1);
        moments.unshift(matched);
      } else {
        // Prepend the verified high-confidence matched scene directly as Clip #1
        moments.unshift({
          sceneId: topUserScene.id,
          startTime: topUserScene.startTime,
          endTime: topUserScene.endTime,
          category: 'User Requested Scene',
          viralScore: 98,
          matchedUserPrompt: true,
          reason: `🎯 High confidence match for your comment: "${userPrompt.trim()}"`,
          hook: 'WATCH THIS',
          title: `Requested: ${userPrompt.trim().slice(0, 36)}`,
          description: `Cutout matching your requested scene: "${userPrompt.trim()}"`,
          hashtags: ['#shorts', '#viral', '#highlight'],
        });
      }
    } else if (hasPromptMatch) {
      // Ensure the matched prompt clip is prioritized at index 0
      const matchedIdx = moments.findIndex((m) => m.matchedUserPrompt === true);
      if (matchedIdx > 0) {
        const [matched] = moments.splice(matchedIdx, 1);
        moments.unshift(matched);
      }
    }
  }

  // Enforce STRICT 25-50s duration & narrative integrity
  return moments.slice(0, targetClipCount).map((m, idx) => {
    let start = Math.max(0, Number(m.startTime));
    let end = Math.min(totalDuration, Number(m.endTime));

    // Match candidate scene if start/end are invalid
    if (isNaN(start) || isNaN(end) || end <= start) {
      const matched = candidateScenes.find((s) => s.id === m.sceneId);
      if (matched) {
        start = matched.startTime;
        end = matched.endTime;
      } else {
        start = Math.max(0, (totalDuration / (idx + 2)) - 15);
        end = start + 32;
      }
    }

    // STRICT DURATION GUARDRAIL: Guarantees full narrative context (25s - 50s)
    let duration = end - start;
    if (duration < 25) {
      const needed = 30 - duration;
      start = Math.max(0, Math.round((start - needed * 0.6) * 10) / 10);
      end = Math.min(totalDuration, Math.round((end + needed * 0.4) * 10) / 10);
    } else if (duration > 55) {
      end = Math.min(totalDuration, Math.round((start + 48) * 10) / 10);
    }

    const baseScore = m.matchedUserPrompt ? 98 : includeSecondaryScores ? 78 : 88;
    const viralScore = Math.min(
      99,
      Math.max(includeSecondaryScores && !m.matchedUserPrompt ? 68 : 75, Number(m.viralScore || baseScore))
    );

    return {
      id: `clip-${idx + 1}`,
      startTime: Math.round(start * 10) / 10,
      endTime: Math.round(end * 10) / 10,
      wordsScore: viralScore,
      reactionScore: 80,
      score: viralScore,
      reason: m.reason || `${m.category || 'Viral'} highlight`,
      hook: (m.hook || 'WATCH THIS').toUpperCase(),
      title: m.title || `Viral Highlight #${idx + 1}`,
      description: m.description || 'Top clip from the stream.',
      hashtags: Array.isArray(m.hashtags) ? m.hashtags : ['#shorts', '#viral'],
      matchedUserPrompt: Boolean(m.matchedUserPrompt),
    };
  });
}
