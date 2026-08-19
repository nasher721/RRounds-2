/**
 * Team Collaboration Types
 * Comments and mentions for collaborative patient care
 */

export interface Comment {
  id: string;
  patientId: string;
  field?: string;
  content: string;
  author: CommentAuthor;
  mentions: string[];
  resolved: boolean;
  resolvedBy?: CommentAuthor;
  resolvedAt?: string;
  parentId?: string; // For threaded replies
  reactions: CommentReaction[];
  createdAt: string;
  updatedAt: string;
}

export interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
  role: string;
}

export interface CommentReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export type CommentField =
  | "general"
  | "neuro"
  | "cv"
  | "resp"
  | "renalGU"
  | "gi"
  | "endo"
  | "heme"
  | "infectious"
  | "skinLines"
  | "dispo"
  | "medications"
  | "labs"
  | "imaging"
  | "clinicalSummary";

export interface CommentThread {
  parent: Comment;
  replies: Comment[];
  totalCount: number;
}

export interface CommentStats {
  totalComments: number;
  unresolvedCount: number;
  mentionsCount: number;
  lastActivity: string;
}
