import fs from 'fs';
import { CONFIG } from './config';
import { FeedbackRecord, LearnedRule, LearningMemory } from './types';

export type { FeedbackRecord, LearnedRule, LearningMemory };


const DEFAULT_CORE_RULES: LearnedRule[] = [
  {
    id: 'rule_anti_single_word',
    rule: 'ANTI-KEYWORD COLLISION: Never select or prioritize a scene merely because it contains a single isolated word or coincidence mention. Demand substantive thematic relevance across multiple sentences.',
    category: 'context_matching',
    source: 'core_system',
    weight: 10,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_thematic_cohesion',
    rule: 'THEMATIC & CONVERSATIONAL CONTEXT: The speakers in the scene must be genuinely engaged in, reacting to, or discussing the user\'s requested scenario as the central subject of that moment.',
    category: 'context_matching',
    source: 'core_system',
    weight: 10,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_narrative_integrity',
    rule: 'NARRATIVE ARC INTEGRITY: Ensure the selected clip includes the introductory setup, the core event/punchline, and the reaction. Do not clip halfway into a thought.',
    category: 'clip_length',
    source: 'core_system',
    weight: 8,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_honest_fallback',
    rule: 'REJECT FALSE MATCHES: If no candidate scene in the entire video actually relates to the user\'s topic, DO NOT force an irrelevant scene. Mark matchedUserPrompt: false and select the best organic viral highlight instead.',
    category: 'avoidance',
    source: 'core_system',
    weight: 10,
    createdAt: new Date().toISOString(),
  },
];

export function getLearningMemory(): LearningMemory {
  try {
    if (fs.existsSync(CONFIG.LEARNING_FILE)) {
      const data = fs.readFileSync(CONFIG.LEARNING_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && Array.isArray(parsed.learnedRules)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed reading learning memory:', err);
  }

  const initialMemory: LearningMemory = {
    version: 1,
    totalLikes: 0,
    totalDislikes: 0,
    learnedRules: DEFAULT_CORE_RULES,
    promptAdditions: [
      'CRITICAL LESSON: Always prioritize semantic narrative context over keyword matching. Single word collisions must be rejected.',
    ],
    recentFeedback: [],
  };

  saveLearningMemory(initialMemory);
  return initialMemory;
}

export function saveLearningMemory(memory: LearningMemory): void {
  try {
    const dir = CONFIG.STORAGE_DIR;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.LEARNING_FILE, JSON.stringify(memory, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed saving learning memory:', err);
  }
}

export function recordClipFeedback(params: {
  clipId: string;
  jobId?: string;
  type: 'like' | 'dislike';
  userPrompt?: string;
  clipTitle?: string;
  clipHook?: string;
  reason?: string;
  userNote?: string;
}): { memory: LearningMemory; newRule?: string } {
  const memory = getLearningMemory();

  const record: FeedbackRecord = {
    id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    clipId: params.clipId,
    jobId: params.jobId,
    type: params.type,
    userPrompt: params.userPrompt?.trim() || undefined,
    clipTitle: params.clipTitle,
    clipHook: params.clipHook,
    reason: params.reason,
    userNote: params.userNote?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  memory.recentFeedback.unshift(record);
  if (memory.recentFeedback.length > 50) {
    memory.recentFeedback = memory.recentFeedback.slice(0, 50);
  }

  let generatedRule = '';

  if (params.type === 'like') {
    memory.totalLikes += 1;
    // Boost positive weight
    const antiWord = memory.learnedRules.find((r) => r.id === 'rule_anti_single_word');
    if (antiWord) antiWord.weight += 1;
    const thematic = memory.learnedRules.find((r) => r.id === 'rule_thematic_cohesion');
    if (thematic) thematic.weight += 1;
  } else {
    memory.totalDislikes += 1;

    // Synthesize negative constraints
    const promptNote = params.userNote?.trim();
    const targetTopic = params.userPrompt?.trim();

    if (promptNote && promptNote.toLowerCase().includes('1 word')) {
      generatedRule = `NEGATIVE CONSTRAINT LEARNED: The user reported clips matching single words with completely wrong context. You MUST ensure at least 60% of the conversation in the scene directly covers the requested theme.`;
    } else if (targetTopic) {
      generatedRule = `NEGATIVE CONSTRAINT LEARNED: The user disliked a clip extracted for topic "${targetTopic}". Never select dialogue containing coincidental words without the full conversational topic context.`;
    } else if (promptNote) {
      generatedRule = `USER FEEDBACK LESSON: Avoid clips like "${params.clipTitle || 'previous clip'}" - reason: ${promptNote}.`;
    } else {
      generatedRule = `NEGATIVE CONSTRAINT: The user rejected a previous scene recommendation. Stricter contextual relevance and narrative setup required.`;
    }

    if (generatedRule && !memory.promptAdditions.includes(generatedRule)) {
      memory.promptAdditions.unshift(generatedRule);
      if (memory.promptAdditions.length > 10) {
        memory.promptAdditions = memory.promptAdditions.slice(0, 10);
      }
    }

    // Add as a learned rule
    const ruleId = `rule_${Date.now()}`;
    memory.learnedRules.unshift({
      id: ruleId,
      rule: generatedRule,
      category: 'avoidance',
      source: 'user_dislike',
      weight: 15,
      createdAt: new Date().toISOString(),
    });
    if (memory.learnedRules.length > 20) {
      memory.learnedRules = memory.learnedRules.slice(0, 20);
    }
  }

  saveLearningMemory(memory);
  return { memory, newRule: generatedRule || undefined };
}

/**
 * Builds the dynamic self-improving prompt section to inject into the LLM judge
 */
export function buildLearningPromptSection(): string {
  const memory = getLearningMemory();

  let text = `
🧠 SELF-IMPROVED AI MEMORY & ADAPTIVE GUIDELINES:
This system continuously learns from user feedback (Total Ratings: ${memory.totalLikes} Likes, ${memory.totalDislikes} Dislikes).

ACTIVE LEARNED RULES:
`;

  memory.learnedRules.slice(0, 8).forEach((r, idx) => {
    text += `${idx + 1}. [Weight ${r.weight}] ${r.rule}\n`;
  });

  if (memory.promptAdditions.length > 0) {
    text += `\nDYNAMIC LESSONS LEARNED FROM RECENT DISLIKES:\n`;
    memory.promptAdditions.slice(0, 5).forEach((add, idx) => {
      text += `- ${add}\n`;
    });
  }

  return text;
}
