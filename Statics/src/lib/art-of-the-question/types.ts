/**
 * Art of the Question — domain types (interviews, questions, analysis, content, user progress).
 */

export type InterviewSource = "video_url" | "transcript" | "text" | "upload";

export type InterviewStatus = "draft" | "analyzing" | "published" | "archived";

export interface Interview {
  interviewId: string;
  title: string;
  source: InterviewSource;
  /** Original URL if video */
  sourceUrl?: string;
  /** Full transcript or conversation text */
  transcript: string;
  /** Optional: guest name, show, topic */
  metadata?: {
    guest?: string;
    topic?: string;
    tone?: string;
    [key: string]: string | undefined;
  };
  status: InterviewStatus;
  /** ISO duration if known */
  durationSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export type QuestionTypeId =
  | "identity"
  | "memory"
  | "contrast"
  | "confession"
  | "tension"
  | "follow_up"
  | "specificity"
  | "reframing"
  | "perspective_shift"
  | "other";

export interface Question {
  questionId: string;
  interviewId: string;
  /** Exact question text */
  text: string;
  /** Seconds from start if known */
  timestampStartSec?: number;
  timestampEndSec?: number;
  /** Interviewer label */
  speaker?: string;
  /** 0–100 composite score */
  score: number;
  /** Primary taxonomy id */
  questionTypeId: QuestionTypeId;
  sortOrder: number;
}

export interface QuestionAnalysis {
  analysisId: string;
  questionId: string;
  interviewId: string;
  type: QuestionTypeId;
  /** Why this question worked — mechanisms, unlock */
  whyItWorked: string;
  /** What changed in the interviewee / response */
  outcome: string;
  /** Stronger phrasing + alternatives */
  rewrite: string;
  alternativePhrasings: string[];
  /** How to use this pattern */
  executionSignal: string;
  whenToUse: string;
  whatToAvoid: string;
  /** Outcome depth: shallow | medium | deep */
  responseDepth?: "shallow" | "medium" | "deep";
}

export interface QuestionType {
  typeId: QuestionTypeId;
  name: string;
  definition: string;
  useCase: string;
  whyItWorks: string;
  examples: string[];
  antiPatterns: string[];
}

export interface ContentAsset {
  assetId: string;
  interviewId: string;
  questionId: string;
  clipStartSec?: number;
  clipEndSec?: number;
  hookMomentSec?: number;
  caption: string;
  voiceoverScript: string;
  titleVariations: string[];
  format?: "hook_question_reaction" | "why_worked" | "bad_vs_good" | "forced_honesty" | "x_vs_y";
  createdAt: string;
}

export interface UserQuestionSave {
  saveId: string;
  userId: string;
  interviewId: string;
  questionId: string;
  notes?: string;
  savedAt: string;
}

export interface UserTypeProgress {
  userId: string;
  typeId: QuestionTypeId;
  status: "seen" | "practiced" | "understood";
  updatedAt: string;
}

export interface AotqFollowUp {
  followUpId: string;
  userId: string;
  questionId: string;
  interviewId: string;
  prompt: string;
  response: string;
  createdAt: string;
}

/** API bundle for a published interview */
export interface InterviewDetailBundle {
  interview: Interview;
  questions: Question[];
  analyses: Record<string, QuestionAnalysis>;
  assets: ContentAsset[];
}
