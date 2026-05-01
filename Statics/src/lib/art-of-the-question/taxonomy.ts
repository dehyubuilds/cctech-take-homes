/**
 * Core IP — question type taxonomy (definitions, use cases, failure modes).
 * Used for classification, learning objectives, and differentiation.
 */

import type { QuestionType, QuestionTypeId } from "./types";

export const QUESTION_TYPE_TAXONOMY: QuestionType[] = [
  {
    typeId: "identity",
    name: "Identity question",
    definition:
      "Asks who someone is in a specific frame — values, self-concept, or the story they tell about themselves.",
    useCase: "When you need grounding truth, not a résumé line.",
    whyItWorks: "Forces a coherent narrative instead of a fact list; often unlocks motivation and stakes.",
    examples: [
      "Who were you before this became your job?",
      "When did you first feel like this was your fight?",
    ],
    antiPatterns: ["Generic ‘tell me about yourself’ with no frame.", "Yes/no identity traps."],
  },
  {
    typeId: "memory",
    name: "Memory question",
    definition: "Anchors the conversation in a concrete scene — a moment, sensory detail, or turning point.",
    useCase: "When abstractions are floating; you need specificity and credibility.",
    whyItWorks: "Memory pulls emotion and detail; weak answers look obviously thin.",
    examples: ["What’s the first thing you remember when you think about that day?"],
    antiPatterns: ["‘How was it?’ without a scene.", "Leading the memory for them."],
  },
  {
    typeId: "contrast",
    name: "Contrast question",
    definition: "Forces comparison between two states, options, or versions of reality.",
    useCase: "When answers are vague; you need a fork in the road.",
    whyItWorks: "Comparison makes tradeoffs visible; hard to hand-wave.",
    examples: ["What did you believe then that you can’t believe now?"],
    antiPatterns: ["False dichotomies.", "Contrasts that aren’t actually different."],
  },
  {
    typeId: "confession",
    name: "Confession question",
    definition: "Invites admission of uncertainty, mistake, fear, or cost — without moralizing.",
    useCase: "When polish is hiding the real story.",
    whyItWorks: "Signals safety and lowers performance mode; unlocks honesty if earned.",
    examples: ["What did you get wrong at first?"],
    antiPatterns: ["Humiliation framing.", "‘Gotcha’ disguised as curiosity."],
  },
  {
    typeId: "tension",
    name: "Tension question",
    definition: "Names a contradiction, risk, or uncomfortable truth in the open.",
    useCase: "When the interview is too smooth; you need productive friction.",
    whyItWorks: "Makes the unstated discussable; strong guests lean in.",
    examples: ["Where does your public position conflict with what you actually do?"],
    antiPatterns: ["Straw-man tension.", "Tension as attack."],
  },
  {
    typeId: "follow_up",
    name: "Follow-up question",
    definition: "Drills into the last answer — word choice, claim, or emotion that was left hanging.",
    useCase: "Always — it’s where interviews become real.",
    whyItWorks: "Proves listening; increases density without new topics.",
    examples: ["You said ‘exhausted’ — what kind of exhausted?"],
    antiPatterns: ["Resetting to a new topic.", "Performative follow-ups that don’t track content."],
  },
  {
    typeId: "specificity",
    name: "Specificity question",
    definition: "Demands a number, name, example, or mechanism instead of a label.",
    useCase: "When you hear nouns without handles.",
    whyItWorks: "Specificity is falsifiable; it raises the cost of generic answers.",
    examples: ["Give me an example in the last 30 days."],
    antiPatterns: ["Micromanagement tone.", "Asking for detail you won’t use."],
  },
  {
    typeId: "reframing",
    name: "Reframing question",
    definition: "Changes the lens — role, timeframe, audience, or stakes — without changing facts.",
    useCase: "When the guest is stuck in one narrative.",
    whyItWorks: "New frame → new information; reveals assumptions.",
    examples: ["If your critic were in the room, how would they describe what you did?"],
    antiPatterns: ["Bad-faith reframes.", "Confusing reframing with contradiction."],
  },
  {
    typeId: "perspective_shift",
    name: "Perspective shift question",
    definition: "Asks the guest to inhabit another viewpoint — person, institution, or future self.",
    useCase: "When empathy or second-order effects matter.",
    whyItWorks: "Unlocks imagination and accountability; surfaces blind spots.",
    examples: ["What would your user say you still don’t understand?"],
    antiPatterns: ["Straw opponents.", "Fantasy perspectives with no anchor."],
  },
  {
    typeId: "other",
    name: "Other / hybrid",
    definition: "Doesn’t map cleanly — still worth analyzing if the moment is high-signal.",
    useCase: "Fallback when structure is novel or mixed.",
    whyItWorks: "Depends on context; label carefully.",
    examples: [],
    antiPatterns: ["Using ‘other’ to skip rigor."],
  },
];

export function getQuestionType(typeId: QuestionTypeId): QuestionType | undefined {
  return QUESTION_TYPE_TAXONOMY.find((t) => t.typeId === typeId);
}
