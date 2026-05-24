export type QuestionStatus = "open" | "answered" | "delayed";
export type QuestionPriority = "community" | "host_pick" | "needs_followup";

export type Answer = {
  id: string;
  responder: string;
  body: string;
  upvotes: number;
  visibleAt: string;
};

export type FollowUp = {
  id: string;
  author: string;
  body: string;
};

export type Question = {
  id: string;
  author: string;
  body: string;
  status: QuestionStatus;
  priority: QuestionPriority;
  upvotes: number;
  quietScore: number;
  tags: string[];
  createdAt: Date;
  answers: Answer[];
  followUps: FollowUp[];
};

export type QuestionRow = {
  id: string;
  author_name: string | null;
  body: string;
  status: QuestionStatus;
  priority: QuestionPriority;
  tags?: string[];
  quiet_score?: number;
  upvotes: number;
  created_at: string;
  answers?: Array<{
    id: string;
    responder_name: string;
    body: string;
    upvotes: number;
    visible_at: string | null;
    created_at: string;
  }>;
  follow_ups?: Array<{
    id: string;
    author_name: string | null;
    body: string;
    created_at: string;
  }>;
};

export function mapQuestionRow(row: QuestionRow): Question {
  return {
    id: row.id,
    author: row.author_name ?? "Anonymous attendee",
    body: row.body,
    status: row.status,
    priority: row.priority,
    upvotes: row.upvotes,
    quietScore: row.quiet_score ?? 0,
    tags: row.tags ?? [],
    createdAt: new Date(row.created_at),
    answers: [...(row.answers ?? [])]
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
      .map((answer) => ({
        id: answer.id,
        responder: answer.responder_name,
        body: answer.body,
        upvotes: answer.upvotes,
        visibleAt: answer.visible_at ? formatDate(new Date(answer.visible_at)) : "Visible now",
      })),
    followUps: [...(row.follow_ups ?? [])]
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
      .map((followUp) => ({
        id: followUp.id,
        author: followUp.author_name ?? "Anonymous attendee",
        body: followUp.body,
      })),
  };
}

export function getQuestionRank(question: Question, now = Date.now()) {
  const hostPickBoost = question.priority === "host_pick" ? 35 : 0;
  const unansweredBoost = question.status === "open" ? 18 : question.status === "delayed" ? 10 : 0;
  const followUpBoost = Math.min(question.followUps.length * 8, 24);
  const quietBoost = question.quietScore * 6;
  const tagBoost = Math.min(question.tags.length * 3, 9);
  const voteScore = Math.min(question.upvotes, 30);
  const agePenalty = Math.min(Math.floor((now - question.createdAt.getTime()) / 86_400_000) * 3, 12);

  return voteScore + hostPickBoost + unansweredBoost + followUpBoost + quietBoost + tagBoost - agePenalty;
}

export function parseTags(value: string) {
  return Array.from(new Set(value.split(",").map(cleanTag).filter(Boolean))).slice(0, 4);
}

export function cleanTag(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 28);
}

export function getQaWindow(startsAt: Date, daysBefore: number, daysAfter: number) {
  const opensAt = new Date(startsAt);
  opensAt.setDate(startsAt.getDate() - daysBefore);

  const closesAt = new Date(startsAt);
  closesAt.setDate(startsAt.getDate() + daysAfter);

  return { opensAt, closesAt };
}

export function isDateWithinWindow(date: Date, opensAt: Date, closesAt: Date) {
  return date >= opensAt && date <= closesAt;
}

export function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(18, 0, 0, 0);
  return date;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    minute: "2-digit",
    hour: "numeric",
  }).format(date);
}
