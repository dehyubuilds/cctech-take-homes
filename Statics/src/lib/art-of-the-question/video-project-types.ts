/**
 * Named video projects: multiple YouTube sources → transcripts → project-scoped Q&A.
 */

export type VideoSourceStatus = "pending" | "processing" | "ready" | "error";

export interface VideoProject {
  projectId: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Set by list API — number of YouTube sources attached to the project. */
  sourceCount?: number;
}

export interface VideoProjectSource {
  sourceId: string;
  projectId: string;
  userId: string;
  youtubeUrl: string;
  videoId: string;
  title?: string;
  channelTitle?: string;
  status: VideoSourceStatus;
  errorMessage?: string;
  /** S3 object key (within bucket) for full transcript JSON when stored off-row */
  transcriptS3Key?: string;
  /** Short preview when transcript is on S3 or truncated */
  transcriptPreview?: string;
  /** Full transcript inline when small and no S3 */
  transcriptText?: string;
  durationSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoProjectAskTurn {
  askId: string;
  projectId: string;
  userId: string;
  prompt: string;
  answer: string;
  createdAt: string;
}
