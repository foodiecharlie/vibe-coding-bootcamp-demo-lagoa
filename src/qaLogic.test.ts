import { describe, expect, it } from "vitest";
import {
  type Question,
  getQaWindow,
  getQuestionRank,
  isDateWithinWindow,
  mapQuestionRow,
  parseTags,
} from "./qaLogic";

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "question-1",
    author: "Anonymous attendee",
    body: "How can quieter attendees surface high-signal questions?",
    status: "open",
    priority: "community",
    upvotes: 0,
    quietScore: 0,
    tags: [],
    createdAt: new Date("2026-05-20T10:00:00.000Z"),
    answers: [],
    followUps: [],
    ...overrides,
  };
}

describe("parseTags", () => {
  it("normalizes, de-duplicates, removes blanks, and limits to four tags", () => {
    expect(parseTags(" AI readiness, Launch   review, AI readiness, , Follow up, Product, Extra ")).toEqual([
      "AI readiness",
      "Launch review",
      "Follow up",
      "Product",
    ]);
  });

  it("truncates overly long tags", () => {
    expect(parseTags("A very long tag name that should not dominate the card")[0]).toHaveLength(28);
  });
});

describe("getQuestionRank", () => {
  const now = new Date("2026-05-24T10:00:00.000Z").getTime();

  it("caps raw upvote advantage so popularity alone cannot dominate discovery", () => {
    const popular = makeQuestion({ upvotes: 300, status: "answered", createdAt: new Date("2026-05-24T09:00:00.000Z") });
    const quietOpen = makeQuestion({
      id: "question-2",
      upvotes: 12,
      quietScore: 3,
      status: "open",
      tags: ["Inclusion"],
      createdAt: new Date("2026-05-24T09:00:00.000Z"),
    });

    expect(getQuestionRank(quietOpen, now)).toBeGreaterThan(getQuestionRank(popular, now));
  });

  it("boosts host picks and follow-up-heavy questions", () => {
    const baseline = makeQuestion({ upvotes: 10 });
    const curated = makeQuestion({
      upvotes: 10,
      priority: "host_pick",
      followUps: [
        { id: "follow-1", author: "Maya", body: "Can you expand?" },
        { id: "follow-2", author: "Jordan", body: "Could this apply to webinars?" },
      ],
    });

    expect(getQuestionRank(curated, now)).toBeGreaterThan(getQuestionRank(baseline, now));
  });
});

describe("Q&A window", () => {
  it("opens before and closes after the webinar using configured day windows", () => {
    const startsAt = new Date("2026-07-15T18:00:00.000Z");
    const window = getQaWindow(startsAt, 14, 7);

    expect(window.opensAt.toISOString()).toBe("2026-07-01T18:00:00.000Z");
    expect(window.closesAt.toISOString()).toBe("2026-07-22T18:00:00.000Z");
    expect(isDateWithinWindow(new Date("2026-07-10T18:00:00.000Z"), window.opensAt, window.closesAt)).toBe(true);
    expect(isDateWithinWindow(new Date("2026-07-30T18:00:00.000Z"), window.opensAt, window.closesAt)).toBe(false);
  });
});

describe("mapQuestionRow", () => {
  it("maps Supabase rows with anonymous authors, sorted nested records, tags, and quiet score", () => {
    const mapped = mapQuestionRow({
      id: "question-1",
      author_name: null,
      body: "What happens after the webinar?",
      status: "delayed",
      priority: "needs_followup",
      tags: ["Follow-up", "Recap"],
      quiet_score: 4,
      upvotes: 8,
      created_at: "2026-05-20T10:00:00.000Z",
      answers: [
        {
          id: "answer-2",
          responder_name: "Sam",
          body: "Second",
          upvotes: 0,
          visible_at: null,
          created_at: "2026-05-20T12:00:00.000Z",
        },
        {
          id: "answer-1",
          responder_name: "Ari",
          body: "First",
          upvotes: 1,
          visible_at: "2026-05-20T11:00:00.000Z",
          created_at: "2026-05-20T11:00:00.000Z",
        },
      ],
      follow_ups: [
        { id: "follow-2", author_name: null, body: "Second", created_at: "2026-05-20T14:00:00.000Z" },
        { id: "follow-1", author_name: "Maya", body: "First", created_at: "2026-05-20T13:00:00.000Z" },
      ],
    });

    expect(mapped.author).toBe("Anonymous attendee");
    expect(mapped.tags).toEqual(["Follow-up", "Recap"]);
    expect(mapped.quietScore).toBe(4);
    expect(mapped.answers.map((answer) => answer.id)).toEqual(["answer-1", "answer-2"]);
    expect(mapped.followUps.map((followUp) => followUp.id)).toEqual(["follow-1", "follow-2"]);
  });
});
