import React, { FormEvent, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Clock3,
  EyeOff,
  MessageCircle,
  MessageSquarePlus,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { hasSupabaseConfig, supabase } from "./supabase";
import "./styles.css";

type Role = "attendee" | "speaker" | "assistant" | "organizer";
type QuestionStatus = "open" | "answered" | "delayed";
type QuestionPriority = "community" | "host_pick" | "needs_followup";
type Filter = "balanced" | "unanswered" | "followups" | "late" | "new";

type Answer = {
  id: string;
  responder: string;
  body: string;
  upvotes: number;
  visibleAt: string;
};

type FollowUp = {
  id: string;
  author: string;
  body: string;
};

type Question = {
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

const webinar = {
  title: "Designing calmer AI product launches",
  host: "Lagoa Product Council",
  startsAt: daysFromNow(7),
  qaWindowDaysBefore: 14,
  qaWindowDaysAfter: 14,
};

const roleMeta: Record<Role, { label: string; eyebrow: string; title: string; copy: string; icon: React.ReactNode }> = {
  attendee: {
    label: "Attendee",
    eyebrow: "Attendee view",
    title: "Ask when the thought is ready.",
    copy: "Submit written questions, vote on what matters, and add follow-ups without needing the live microphone.",
    icon: <UsersRound size={17} />,
  },
  speaker: {
    label: "Speaker",
    eyebrow: "Speaker view",
    title: "Answer with room to think.",
    copy: "See the strongest questions, mark delayed responses, and publish answers when they are ready.",
    icon: <UserRoundCheck size={17} />,
  },
  assistant: {
    label: "Assistant",
    eyebrow: "Assistant view",
    title: "Prepare the room before it gets loud.",
    copy: "Surface themes, flag follow-ups, and help speakers focus on the highest-signal queue.",
    icon: <Sparkles size={17} />,
  },
  organizer: {
    label: "Organizer",
    eyebrow: "Organizer view",
    title: "Keep the full Q&A lifecycle on track.",
    copy: "Manage webinar windows, queue health, host picks, and post-event answer completion.",
    icon: <Settings2 size={17} />,
  },
};

const initialQuestions: Question[] = [
  {
    id: "sample-1",
    author: "Anonymous attendee",
    body: "How should a small product team decide which AI support workflows are ready for customers?",
    status: "answered",
    priority: "host_pick",
    upvotes: 48,
    quietScore: 1,
    tags: ["AI readiness", "Support"],
    createdAt: daysAgo(2),
    answers: [
      {
        id: "sample-answer-1",
        responder: "Ari, speaker",
        body: "Start with the moments where a mistake is recoverable, then move toward higher trust workflows after you have feedback loops in place.",
        upvotes: 18,
        visibleAt: "Visible now",
      },
    ],
    followUps: [{ id: "sample-follow-up-1", author: "Maya", body: "Would this change for regulated teams?" }],
  },
  {
    id: "sample-2",
    author: "Maya",
    body: "Can you share a lightweight way to collect concerns from quieter stakeholders before a launch review?",
    status: "delayed",
    priority: "needs_followup",
    upvotes: 35,
    quietScore: 5,
    tags: ["Stakeholders", "Launch review"],
    createdAt: daysAgo(1),
    answers: [
      {
        id: "sample-answer-2",
        responder: "Sam, assistant",
        body: "We are grouping examples and will publish a fuller answer after the webinar.",
        upvotes: 9,
        visibleAt: "Tomorrow at 10:00",
      },
    ],
    followUps: [
      { id: "sample-follow-up-2", author: "Anonymous attendee", body: "A template would be helpful here." },
      { id: "sample-follow-up-3", author: "Jordan", body: "Especially for cross-functional reviews." },
    ],
  },
  {
    id: "sample-3",
    author: "Jordan",
    body: "What signals tell you that a live Q&A is missing important questions from the room?",
    status: "open",
    priority: "community",
    upvotes: 21,
    quietScore: 4,
    tags: ["Live Q&A", "Inclusion"],
    createdAt: hoursAgo(4),
    answers: [],
    followUps: [],
  },
];

const statusLabels: Record<QuestionStatus, string> = {
  open: "Open",
  answered: "Answered",
  delayed: "Delayed response",
};

const priorityLabels: Record<QuestionPriority, string> = {
  community: "Community",
  host_pick: "Host pick",
  needs_followup: "Needs follow-up",
};

const filterLabels: Record<Filter, string> = {
  balanced: "Balanced",
  unanswered: "Unanswered",
  followups: "Follow-ups",
  late: "Late",
  new: "New",
};

function App() {
  const [activeRole, setActiveRole] = useState<Role>("attendee");
  const [questions, setQuestions] = useState(initialQuestions);
  const [webinarId, setWebinarId] = useState<string | null>(null);
  const [supportsQuestionTags, setSupportsQuestionTags] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(
    hasSupabaseConfig ? "Connecting to Supabase..." : "Using local sample data",
  );
  const [filter, setFilter] = useState<Filter>("balanced");
  const [questionText, setQuestionText] = useState("");
  const [askAnonymously, setAskAnonymously] = useState(true);
  const [authorName, setAuthorName] = useState("");
  const [tagText, setTagText] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const qaWindow = getQaWindow(webinar.startsAt, webinar.qaWindowDaysBefore, webinar.qaWindowDaysAfter);
  const isOpen = isDateWithinWindow(new Date(), qaWindow.opensAt, qaWindow.closesAt);
  const currentRole = roleMeta[activeRole];

  useEffect(() => {
    async function loadSupabaseData() {
      if (!supabase) {
        return;
      }

      const { data: existingWebinar, error: webinarError } = await supabase
        .from("webinars")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (webinarError) {
        setConnectionStatus(`Supabase error: ${webinarError.message}`);
        return;
      }

      let resolvedWebinar = existingWebinar;

      if (!resolvedWebinar) {
        const { data: insertedWebinar, error: insertError } = await supabase
          .from("webinars")
          .insert({
            title: webinar.title,
            host: webinar.host,
            starts_at: webinar.startsAt.toISOString(),
            qa_window_days_before: webinar.qaWindowDaysBefore,
            qa_window_days_after: webinar.qaWindowDaysAfter,
          })
          .select("id")
          .single();

        if (insertError) {
          setConnectionStatus(`Supabase error: ${insertError.message}`);
          return;
        }

        resolvedWebinar = insertedWebinar;
      }

      setWebinarId(resolvedWebinar.id);

      let tagSchemaAvailable = true;
      let questionRows: QuestionRow[] | null = null;
      let { data: richQuestionRows, error: questionError } = await supabase
        .from("questions")
        .select(
          "id, author_name, body, status, priority, tags, quiet_score, upvotes, created_at, answers(id, responder_name, body, upvotes, visible_at, created_at), follow_ups(id, author_name, body, created_at)",
        )
        .eq("webinar_id", resolvedWebinar.id)
        .order("created_at", { ascending: false });
      questionRows = richQuestionRows as QuestionRow[] | null;

      if (questionError) {
        tagSchemaAvailable = false;
        setSupportsQuestionTags(false);
        const legacyResult = await supabase
          .from("questions")
          .select(
            "id, author_name, body, status, priority, upvotes, created_at, answers(id, responder_name, body, upvotes, visible_at, created_at), follow_ups(id, author_name, body, created_at)",
          )
          .eq("webinar_id", resolvedWebinar.id)
          .order("created_at", { ascending: false });

        questionRows = legacyResult.data as QuestionRow[] | null;
        questionError = legacyResult.error;

        if (questionError) {
          setConnectionStatus(`Supabase error: ${questionError.message}`);
          return;
        }
      }

      if (questionRows && questionRows.length > 0) {
        setQuestions(questionRows.map(mapQuestionRow));
      }

      setConnectionStatus(
        tagSchemaAvailable ? "Connected to Supabase" : "Connected to Supabase. Run schema.sql to persist tags.",
      );
    }

    void loadSupabaseData();
  }, []);

  const sortedQuestions = useMemo(() => {
    const visible =
      filter === "unanswered"
        ? questions.filter((question) => question.status !== "answered")
        : filter === "followups"
          ? questions.filter((question) => question.followUps.length > 0 || question.priority === "needs_followup")
          : filter === "late"
            ? questions.filter((question) => question.status === "delayed" || question.createdAt < daysAgo(1))
            : questions;

    return [...visible].sort((left, right) => {
      if (filter === "new") {
        return right.createdAt.getTime() - left.createdAt.getTime();
      }

      return getQuestionRank(right) - getQuestionRank(left);
    });
  }, [filter, questions]);

  const tagCounts = useMemo(() => {
    return questions.reduce<Record<string, number>>((counts, question) => {
      question.tags.forEach((tag) => {
        counts[tag] = (counts[tag] ?? 0) + 1;
      });
      return counts;
    }, {});
  }, [questions]);

  const stats = useMemo(
    () => ({
      open: questions.filter((question) => question.status === "open").length,
      delayed: questions.filter((question) => question.status === "delayed").length,
      answered: questions.filter((question) => question.status === "answered").length,
      followUps: questions.reduce((total, question) => total + question.followUps.length, 0),
      hostPicks: questions.filter((question) => question.priority === "host_pick").length,
    }),
    [questions],
  );

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = questionText.trim();

    if (!trimmed || !isOpen) {
      return;
    }
    const tags = parseTags(tagText);

    setQuestions((current) => [
      {
        id: crypto.randomUUID(),
        author: askAnonymously ? "Anonymous attendee" : authorName.trim() || "Attendee",
        body: trimmed,
        status: "open",
        priority: "community",
        upvotes: 0,
        quietScore: tags.length > 0 ? 1 : 2,
        tags,
        createdAt: new Date(),
        answers: [],
        followUps: [],
      },
      ...current,
    ]);

    if (supabase && webinarId) {
      const payload = {
        webinar_id: webinarId,
        author_name: askAnonymously ? null : authorName.trim() || "Attendee",
        body: trimmed,
        status: "open",
        priority: "community",
        upvotes: 0,
        ...(supportsQuestionTags ? { tags, quiet_score: tags.length > 0 ? 1 : 2 } : {}),
      };
      void supabase.from("questions").insert(payload);
    }

    setQuestionText("");
    setTagText("");
    setFilter("new");
  }

  function upvoteQuestion(questionId: string) {
    const question = questions.find((current) => current.id === questionId);

    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId ? { ...question, upvotes: question.upvotes + 1 } : question,
      ),
    );

    if (supabase && question && isUuid(questionId)) {
      void supabase.from("questions").update({ upvotes: question.upvotes + 1 }).eq("id", questionId);
    }
  }

  function upvoteAnswer(questionId: string, answerId: string) {
    const answer = questions.flatMap((question) => question.answers).find((current) => current.id === answerId);

    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              answers: question.answers.map((answer) =>
                answer.id === answerId ? { ...answer, upvotes: answer.upvotes + 1 } : answer,
              ),
            }
          : question,
      ),
    );

    if (supabase && answer && isUuid(answerId)) {
      void supabase.from("answers").update({ upvotes: answer.upvotes + 1 }).eq("id", answerId);
    }
  }

  function addFollowUp(questionId: string, body: string) {
    const trimmed = body.trim();

    if (!trimmed) {
      return;
    }

    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              priority: question.priority === "host_pick" ? "host_pick" : "needs_followup",
              followUps: [...question.followUps, { id: crypto.randomUUID(), author: "Anonymous attendee", body: trimmed }],
            }
          : question,
      ),
    );

    if (supabase && isUuid(questionId)) {
      void supabase.from("follow_ups").insert({
        question_id: questionId,
        author_name: null,
        body: trimmed,
      });
      void supabase.from("questions").update({ priority: "needs_followup" }).eq("id", questionId);
    }
  }

  function addTag(questionId: string, tag: string) {
    const cleaned = cleanTag(tag);
    if (!cleaned) {
      return;
    }

    let nextTags: string[] = [];
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) {
          return question;
        }
        nextTags = Array.from(new Set([...question.tags, cleaned]));
        return { ...question, tags: nextTags, quietScore: Math.max(question.quietScore, 2) };
      }),
    );

    if (supabase && supportsQuestionTags && isUuid(questionId)) {
      void supabase.from("questions").update({ tags: nextTags, quiet_score: 2 }).eq("id", questionId);
    }
  }

  function setQuestionStatus(questionId: string, status: QuestionStatus) {
    setQuestions((current) =>
      current.map((question) => (question.id === questionId ? { ...question, status } : question)),
    );

    if (supabase && isUuid(questionId)) {
      void supabase.from("questions").update({ status }).eq("id", questionId);
    }
  }

  function setQuestionPriority(questionId: string, priority: QuestionPriority) {
    setQuestions((current) =>
      current.map((question) => (question.id === questionId ? { ...question, priority } : question)),
    );

    if (supabase && isUuid(questionId)) {
      void supabase.from("questions").update({ priority }).eq("id", questionId);
    }
  }

  function toggleHostPick(questionId: string) {
    const nextPriority =
      questions.find((question) => question.id === questionId)?.priority === "host_pick" ? "community" : "host_pick";

    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? { ...question, priority: nextPriority }
          : question,
      ),
    );

    if (supabase && isUuid(questionId)) {
      void supabase.from("questions").update({ priority: nextPriority }).eq("id", questionId);
    }
  }

  function publishAnswer(questionId: string, delayed: boolean) {
    const body = answerDrafts[questionId]?.trim();

    if (!body) {
      return;
    }

    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              status: delayed ? "delayed" : "answered",
              answers: [
                ...question.answers,
                {
                  id: crypto.randomUUID(),
                  responder: activeRole === "speaker" ? "Ari, speaker" : "Sam, assistant",
                  body,
                  upvotes: 0,
                  visibleAt: delayed ? "Scheduled after webinar" : "Visible now",
                },
              ],
            }
          : question,
      ),
    );

    if (supabase && isUuid(questionId)) {
      void supabase.from("answers").insert({
        question_id: questionId,
        responder_name: activeRole === "speaker" ? "Ari, speaker" : "Sam, assistant",
        body,
        upvotes: 0,
        visible_at: delayed ? daysFromNow(8).toISOString() : new Date().toISOString(),
      });
      void supabase.from("questions").update({ status: delayed ? "delayed" : "answered" }).eq("id", questionId);
    }

    setAnswerDrafts((current) => ({ ...current, [questionId]: "" }));
  }

  return (
    <main>
      <header className="app-header">
        <nav className="topbar" aria-label="Primary">
          <div className="brand">
            <span className="brand-mark">L</span>
            <span>Lagoa Q&A</span>
          </div>
          <div className="role-switcher" aria-label="Role views">
            {(Object.keys(roleMeta) as Role[]).map((role) => (
              <button
                className={activeRole === role ? "active" : ""}
                key={role}
                onClick={() => setActiveRole(role)}
                type="button"
              >
                {roleMeta[role].icon}
                {roleMeta[role].label}
              </button>
            ))}
          </div>
        </nav>

        <section className="intro">
          <div>
            <p className="eyebrow">{currentRole.eyebrow}</p>
            <h1>{currentRole.title}</h1>
            <p className="intro-copy">{currentRole.copy}</p>
            <p className={`connection-status ${hasSupabaseConfig ? "online" : "local"}`}>{connectionStatus}</p>
          </div>
          <div className="window-panel" aria-label="Q&A timeline">
            <TimelineItem icon={<CalendarDays size={18} />} label="Opens" value={formatDate(qaWindow.opensAt)} />
            <TimelineItem icon={<MessageCircle size={18} />} label="Live session" value={formatDate(webinar.startsAt)} />
            <TimelineItem icon={<Clock3 size={18} />} label="Closes" value={formatDate(qaWindow.closesAt)} />
          </div>
        </section>
      </header>

      {activeRole === "attendee" && (
        <AttendeeView
          addFollowUp={addFollowUp}
          askAnonymously={askAnonymously}
          authorName={authorName}
          filter={filter}
          isOpen={isOpen}
          questionText={questionText}
          questions={sortedQuestions}
          setAskAnonymously={setAskAnonymously}
          setAuthorName={setAuthorName}
          setFilter={setFilter}
          setQuestionText={setQuestionText}
          setTagText={setTagText}
          submitQuestion={submitQuestion}
          tagCounts={tagCounts}
          tagText={tagText}
          upvoteAnswer={upvoteAnswer}
          upvoteQuestion={upvoteQuestion}
        />
      )}

      {activeRole === "speaker" && (
        <SpeakerView
          answerDrafts={answerDrafts}
          publishAnswer={publishAnswer}
          questions={sortedQuestions}
          setAnswerDrafts={setAnswerDrafts}
          setQuestionStatus={setQuestionStatus}
        />
      )}

      {activeRole === "assistant" && (
        <AssistantView
          questions={questions}
          addTag={addTag}
          setQuestionPriority={setQuestionPriority}
          setQuestionStatus={setQuestionStatus}
          toggleHostPick={toggleHostPick}
        />
      )}

      {activeRole === "organizer" && (
        <OrganizerView
          qaWindow={qaWindow}
          questions={questions}
          setQuestionStatus={setQuestionStatus}
          stats={stats}
          toggleHostPick={toggleHostPick}
        />
      )}
    </main>
  );
}

function AttendeeView({
  addFollowUp,
  askAnonymously,
  authorName,
  filter,
  isOpen,
  questionText,
  questions,
  setAskAnonymously,
  setAuthorName,
  setFilter,
  setQuestionText,
  setTagText,
  submitQuestion,
  tagCounts,
  tagText,
  upvoteAnswer,
  upvoteQuestion,
}: {
  addFollowUp: (questionId: string, body: string) => void;
  askAnonymously: boolean;
  authorName: string;
  filter: Filter;
  isOpen: boolean;
  questionText: string;
  questions: Question[];
  setAskAnonymously: (value: boolean) => void;
  setAuthorName: (value: string) => void;
  setFilter: (value: Filter) => void;
  setQuestionText: (value: string) => void;
  setTagText: (value: string) => void;
  submitQuestion: (event: FormEvent<HTMLFormElement>) => void;
  tagCounts: Record<string, number>;
  tagText: string;
  upvoteAnswer: (questionId: string, answerId: string) => void;
  upvoteQuestion: (questionId: string) => void;
}) {
  return (
    <>
      <form className="composer" id="ask" aria-label="Ask a question" onSubmit={submitQuestion}>
        <div className="composer-header">
          <MessageSquarePlus size={20} />
          <div>
            <h2>Write a question</h2>
            <p>{isOpen ? "Open for written questions now." : "This Q&A window is currently closed."}</p>
          </div>
        </div>
        <textarea
          aria-label="Question text"
          disabled={!isOpen}
          onChange={(event) => setQuestionText(event.target.value)}
          placeholder="What would you like the host to answer?"
          value={questionText}
        />
        <div className="tag-input-row">
          <Tag size={16} />
          <input
            aria-label="Question tags"
            onChange={(event) => setTagText(event.target.value)}
            placeholder="Add tags: AI readiness, Launch review"
            value={tagText}
          />
        </div>
        <div className="composer-actions">
          <div className="identity-row">
            <label className="checkbox-row">
              <input
                checked={askAnonymously}
                onChange={(event) => setAskAnonymously(event.target.checked)}
                type="checkbox"
              />
              Ask anonymously
            </label>
            {!askAnonymously && (
              <input
                aria-label="Display name"
                className="name-input"
                onChange={(event) => setAuthorName(event.target.value)}
                placeholder="Display name"
                value={authorName}
              />
            )}
          </div>
          <button disabled={!questionText.trim() || !isOpen}>
            <Send size={17} />
            Submit
          </button>
        </div>
      </form>

      <QueueSection
        filter={filter}
        questions={questions}
        setFilter={setFilter}
        tagCounts={tagCounts}
        renderQuestion={(question) => (
          <QuestionCard
            addFollowUp={addFollowUp}
            key={question.id}
            question={question}
            upvoteAnswer={upvoteAnswer}
            upvoteQuestion={upvoteQuestion}
          />
        )}
      />
    </>
  );
}

function SpeakerView({
  answerDrafts,
  publishAnswer,
  questions,
  setAnswerDrafts,
  setQuestionStatus,
}: {
  answerDrafts: Record<string, string>;
  publishAnswer: (questionId: string, delayed: boolean) => void;
  questions: Question[];
  setAnswerDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setQuestionStatus: (questionId: string, status: QuestionStatus) => void;
}) {
  return (
    <section className="workspace-grid">
      <div className="question-column">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Speaker queue</p>
            <h2>Questions to answer</h2>
          </div>
        </div>
        <div className="question-list">
          {questions.map((question) => (
            <article className="speaker-card" key={question.id}>
              <QuestionSummary question={question} />
              <textarea
                aria-label={`Answer ${question.body}`}
                onChange={(event) =>
                  setAnswerDrafts((current) => ({ ...current, [question.id]: event.target.value }))
                }
                placeholder="Draft a thoughtful answer"
                value={answerDrafts[question.id] ?? ""}
              />
              <div className="triage-actions">
                <button onClick={() => publishAnswer(question.id, false)} type="button">
                  <CheckCircle2 size={15} />
                  Publish
                </button>
                <button onClick={() => publishAnswer(question.id, true)} type="button">
                  <Clock3 size={15} />
                  Schedule recap
                </button>
                <button onClick={() => setQuestionStatus(question.id, "open")} type="button">
                  <MessageCircle size={15} />
                  Keep open
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <RolePanel
        title="Speaker focus"
        metrics={[
          ["Host picks", String(questions.filter((question) => question.priority === "host_pick").length)],
          ["Open", String(questions.filter((question) => question.status === "open").length)],
          ["Delayed", String(questions.filter((question) => question.status === "delayed").length)],
        ]}
      />
    </section>
  );
}

function AssistantView({
  addTag,
  questions,
  setQuestionPriority,
  setQuestionStatus,
  toggleHostPick,
}: {
  addTag: (questionId: string, tag: string) => void;
  questions: Question[];
  setQuestionPriority: (questionId: string, priority: QuestionPriority) => void;
  setQuestionStatus: (questionId: string, status: QuestionStatus) => void;
  toggleHostPick: (questionId: string) => void;
}) {
  return (
    <section className="workspace-grid">
      <div className="question-column">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Assistant prep</p>
            <h2>Moderation queue</h2>
          </div>
        </div>
        <div className="moderation-list">
          {questions.map((question) => (
            <article className="moderation-card" key={question.id}>
              <QuestionSummary question={question} />
              <TagEditor questionId={question.id} onAddTag={addTag} />
              <div className="triage-actions">
                <button onClick={() => toggleHostPick(question.id)} type="button">
                  <Star size={15} />
                  {question.priority === "host_pick" ? "Unpick" : "Host pick"}
                </button>
                <button onClick={() => setQuestionPriority(question.id, "needs_followup")} type="button">
                  <MessageSquarePlus size={15} />
                  Needs follow-up
                </button>
                <button onClick={() => setQuestionStatus(question.id, "delayed")} type="button">
                  <Clock3 size={15} />
                  Prep later
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <RolePanel
        title="Assistant signals"
        metrics={[
          ["Follow-ups", String(questions.reduce((total, question) => total + question.followUps.length, 0))],
          ["Needs follow-up", String(questions.filter((question) => question.priority === "needs_followup").length)],
          ["Community votes", String(questions.reduce((total, question) => total + question.upvotes, 0))],
        ]}
      />
    </section>
  );
}

function OrganizerView({
  qaWindow,
  questions,
  setQuestionStatus,
  stats,
  toggleHostPick,
}: {
  qaWindow: { opensAt: Date; closesAt: Date };
  questions: Question[];
  setQuestionStatus: (questionId: string, status: QuestionStatus) => void;
  stats: { open: number; delayed: number; answered: number; followUps: number; hostPicks: number };
  toggleHostPick: (questionId: string) => void;
}) {
  return (
    <section className="workspace-grid">
      <div className="organizer-dashboard">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Organizer command center</p>
            <h2>{webinar.title}</h2>
          </div>
          <ShieldCheck size={20} />
        </div>
        <div className="dashboard-metrics">
          <Metric label="Open" value={String(stats.open)} />
          <Metric label="Answered" value={String(stats.answered)} />
          <Metric label="Delayed" value={String(stats.delayed)} />
          <Metric label="Host picks" value={String(stats.hostPicks)} />
        </div>
        <div className="settings-panel">
          <TimelineItem icon={<CalendarDays size={18} />} label="Q&A opens" value={formatDate(qaWindow.opensAt)} />
          <TimelineItem icon={<Clock3 size={18} />} label="Q&A closes" value={formatDate(qaWindow.closesAt)} />
          <TimelineItem icon={<UsersRound size={18} />} label="Speaker team" value={webinar.host} />
        </div>
      </div>
      <aside className="organizer-panel" aria-label="Organizer tools">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Queue health</p>
            <h2>Triage</h2>
          </div>
          <Sparkles size={19} />
        </div>
        <div className="triage-list">
          {questions.map((question) => (
            <div className="triage-item" key={question.id}>
              <p>{question.body}</p>
              <div className="triage-actions">
                <button onClick={() => toggleHostPick(question.id)} type="button">
                  <Star size={15} />
                  Pick
                </button>
                <button onClick={() => setQuestionStatus(question.id, "delayed")} type="button">
                  <Clock3 size={15} />
                  Delay
                </button>
                <button onClick={() => setQuestionStatus(question.id, "answered")} type="button">
                  <CheckCircle2 size={15} />
                  Done
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function QueueSection({
  filter,
  questions,
  renderQuestion,
  setFilter,
  tagCounts,
}: {
  filter: Filter;
  questions: Question[];
  renderQuestion: (question: Question) => React.ReactNode;
  setFilter: (value: Filter) => void;
  tagCounts: Record<string, number>;
}) {
  return (
    <section className="question-column">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Discovery queue</p>
          <h2>Questions worth finding</h2>
        </div>
        <div className="segmented" aria-label="Question filter">
          {(["balanced", "unanswered", "followups", "late", "new"] as Filter[]).map((option) => (
            <button
              className={filter === option ? "active" : ""}
              key={option}
              onClick={() => setFilter(option)}
              type="button"
            >
              {filterLabels[option]}
            </button>
          ))}
        </div>
      </div>
      <div className="tag-cloud" aria-label="Popular question tags">
        {Object.entries(tagCounts)
          .sort((left, right) => right[1] - left[1])
          .slice(0, 6)
          .map(([tag, count]) => (
            <span key={tag}>
              <Tag size={13} />
              {tag}
              <strong>{count}</strong>
            </span>
          ))}
      </div>
      <div className="question-list">{questions.map(renderQuestion)}</div>
    </section>
  );
}

function RolePanel({ metrics, title }: { metrics: Array<[string, string]>; title: string }) {
  return (
    <aside className="organizer-panel" aria-label={title}>
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Live summary</p>
          <h2>{title}</h2>
        </div>
        <Sparkles size={19} />
      </div>
      <div className="metric-list">
        {metrics.map(([label, value]) => (
          <Metric key={label} label={label} value={value} />
        ))}
      </div>
    </aside>
  );
}

function TagEditor({ onAddTag, questionId }: { onAddTag: (questionId: string, tag: string) => void; questionId: string }) {
  const [value, setValue] = useState("");

  function submitTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddTag(questionId, value);
    setValue("");
  }

  return (
    <form className="tag-editor" onSubmit={submitTag}>
      <Tag size={15} />
      <input
        aria-label="Add moderation tag"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Add tag"
        value={value}
      />
      <button disabled={!value.trim()} type="submit">
        Add
      </button>
    </form>
  );
}

function TimelineItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="timeline-item">
      <span>{icon}</span>
      <div>
        <strong>{label}</strong>
        <p>{value}</p>
      </div>
    </div>
  );
}

function QuestionCard({
  addFollowUp,
  question,
  upvoteAnswer,
  upvoteQuestion,
}: {
  addFollowUp: (questionId: string, body: string) => void;
  question: Question;
  upvoteAnswer: (questionId: string, answerId: string) => void;
  upvoteQuestion: (questionId: string) => void;
}) {
  const [followUpText, setFollowUpText] = useState("");

  function submitFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addFollowUp(question.id, followUpText);
    setFollowUpText("");
  }

  return (
    <article className="question-card">
      <button className="vote-button" onClick={() => upvoteQuestion(question.id)} type="button">
        <ArrowUp size={18} />
        <span>{question.upvotes}</span>
      </button>
      <div className="question-body">
        <QuestionSummary question={question} />

        {question.answers.length > 0 && (
          <div className="answer-list">
            {question.answers.map((answer) => (
              <div className="answer" key={answer.id}>
                <div>
                  <strong>{answer.responder}</strong>
                  <p>{answer.body}</p>
                  <span>
                    <EyeOff size={13} />
                    {answer.visibleAt}
                  </span>
                </div>
                <button type="button" onClick={() => upvoteAnswer(question.id, answer.id)}>
                  <ArrowUp size={15} />
                  {answer.upvotes}
                </button>
              </div>
            ))}
          </div>
        )}

        {question.followUps.length > 0 && (
          <div className="follow-up-list">
            {question.followUps.map((followUp) => (
              <p key={followUp.id}>
                <strong>{followUp.author}:</strong> {followUp.body}
              </p>
            ))}
          </div>
        )}

        <form className="follow-up-form" onSubmit={submitFollowUp}>
          <input
            aria-label="Follow-up question"
            onChange={(event) => setFollowUpText(event.target.value)}
            placeholder="Add a follow-up"
            value={followUpText}
          />
          <button disabled={!followUpText.trim()} type="submit">
            <Send size={15} />
          </button>
        </form>
      </div>
    </article>
  );
}

function QuestionSummary({ question }: { question: Question }) {
  return (
    <>
      <div className="question-meta">
        <span>{question.author}</span>
        <span>{relativeTime(question.createdAt)}</span>
        <span>{question.upvotes} votes</span>
      </div>
      <h3>{question.body}</h3>
      <div className="question-tags">
        {question.tags.map((tag) => (
          <span key={tag}>
            <Tag size={12} />
            {tag}
          </span>
        ))}
      </div>
      <div className="question-footer">
        <span className={`status ${question.status}`}>
          {question.status === "answered" ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
          {statusLabels[question.status]}
        </span>
        <span className="pill">
          <Star size={14} />
          {priorityLabels[question.priority]}
        </span>
        <span>{question.answers.length} answers</span>
        <span>{question.followUps.length} follow-ups</span>
        <span>rank {getQuestionRank(question)}</span>
      </div>
      {question.status === "delayed" && (
        <div className="delayed-notice">
          <Clock3 size={15} />
          Scheduled response. Attendees should check back after the webinar or watch for the shared recap link.
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type QuestionRow = {
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

function mapQuestionRow(row: QuestionRow): Question {
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getQuestionRank(question: Question) {
  const hostPickBoost = question.priority === "host_pick" ? 35 : 0;
  const unansweredBoost = question.status === "open" ? 18 : question.status === "delayed" ? 10 : 0;
  const followUpBoost = Math.min(question.followUps.length * 8, 24);
  const quietBoost = question.quietScore * 6;
  const tagBoost = Math.min(question.tags.length * 3, 9);
  const voteScore = Math.min(question.upvotes, 30);
  const agePenalty = Math.min(Math.floor((Date.now() - question.createdAt.getTime()) / 86_400_000) * 3, 12);

  return voteScore + hostPickBoost + unansweredBoost + followUpBoost + quietBoost + tagBoost - agePenalty;
}

function parseTags(value: string) {
  return Array.from(new Set(value.split(",").map(cleanTag).filter(Boolean))).slice(0, 4);
}

function cleanTag(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 28);
}

function getQaWindow(startsAt: Date, daysBefore: number, daysAfter: number) {
  const opensAt = new Date(startsAt);
  opensAt.setDate(startsAt.getDate() - daysBefore);

  const closesAt = new Date(startsAt);
  closesAt.setDate(startsAt.getDate() + daysAfter);

  return { opensAt, closesAt };
}

function isDateWithinWindow(date: Date, opensAt: Date, closesAt: Date) {
  return date >= opensAt && date <= closesAt;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(18, 0, 0, 0);
  return date;
}

function hoursAgo(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    minute: "2-digit",
    hour: "numeric",
  }).format(date);
}

function relativeTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const hours = Math.max(1, Math.round(diff / 1000 / 60 / 60));

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
