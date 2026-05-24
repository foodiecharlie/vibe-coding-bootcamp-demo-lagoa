import React, { FormEvent, useMemo, useState } from "react";
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
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import "./styles.css";

type Role = "attendee" | "speaker" | "assistant" | "organizer";
type QuestionStatus = "open" | "answered" | "delayed";
type QuestionPriority = "community" | "host_pick" | "needs_followup";
type Filter = "top" | "new" | "open";

type Answer = {
  id: number;
  responder: string;
  body: string;
  upvotes: number;
  visibleAt: string;
};

type FollowUp = {
  id: number;
  author: string;
  body: string;
};

type Question = {
  id: number;
  author: string;
  body: string;
  status: QuestionStatus;
  priority: QuestionPriority;
  upvotes: number;
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
    id: 1,
    author: "Anonymous attendee",
    body: "How should a small product team decide which AI support workflows are ready for customers?",
    status: "answered",
    priority: "host_pick",
    upvotes: 48,
    createdAt: daysAgo(2),
    answers: [
      {
        id: 101,
        responder: "Ari, speaker",
        body: "Start with the moments where a mistake is recoverable, then move toward higher trust workflows after you have feedback loops in place.",
        upvotes: 18,
        visibleAt: "Visible now",
      },
    ],
    followUps: [{ id: 201, author: "Maya", body: "Would this change for regulated teams?" }],
  },
  {
    id: 2,
    author: "Maya",
    body: "Can you share a lightweight way to collect concerns from quieter stakeholders before a launch review?",
    status: "delayed",
    priority: "needs_followup",
    upvotes: 35,
    createdAt: daysAgo(1),
    answers: [
      {
        id: 102,
        responder: "Sam, assistant",
        body: "We are grouping examples and will publish a fuller answer after the webinar.",
        upvotes: 9,
        visibleAt: "Tomorrow at 10:00",
      },
    ],
    followUps: [
      { id: 202, author: "Anonymous attendee", body: "A template would be helpful here." },
      { id: 203, author: "Jordan", body: "Especially for cross-functional reviews." },
    ],
  },
  {
    id: 3,
    author: "Jordan",
    body: "What signals tell you that a live Q&A is missing important questions from the room?",
    status: "open",
    priority: "community",
    upvotes: 21,
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

function App() {
  const [activeRole, setActiveRole] = useState<Role>("attendee");
  const [questions, setQuestions] = useState(initialQuestions);
  const [filter, setFilter] = useState<Filter>("top");
  const [questionText, setQuestionText] = useState("");
  const [askAnonymously, setAskAnonymously] = useState(true);
  const [authorName, setAuthorName] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});

  const qaWindow = getQaWindow(webinar.startsAt, webinar.qaWindowDaysBefore, webinar.qaWindowDaysAfter);
  const isOpen = isDateWithinWindow(new Date(), qaWindow.opensAt, qaWindow.closesAt);
  const currentRole = roleMeta[activeRole];

  const sortedQuestions = useMemo(() => {
    const visible = filter === "open" ? questions.filter((question) => question.status === "open") : questions;

    return [...visible].sort((left, right) => {
      if (filter === "new") {
        return right.createdAt.getTime() - left.createdAt.getTime();
      }

      const leftBoost = left.priority === "host_pick" ? 1000 : 0;
      const rightBoost = right.priority === "host_pick" ? 1000 : 0;
      return right.upvotes + rightBoost - (left.upvotes + leftBoost);
    });
  }, [filter, questions]);

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

    setQuestions((current) => [
      {
        id: Date.now(),
        author: askAnonymously ? "Anonymous attendee" : authorName.trim() || "Attendee",
        body: trimmed,
        status: "open",
        priority: "community",
        upvotes: 0,
        createdAt: new Date(),
        answers: [],
        followUps: [],
      },
      ...current,
    ]);
    setQuestionText("");
    setFilter("new");
  }

  function upvoteQuestion(questionId: number) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId ? { ...question, upvotes: question.upvotes + 1 } : question,
      ),
    );
  }

  function upvoteAnswer(questionId: number, answerId: number) {
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
  }

  function addFollowUp(questionId: number, body: string) {
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
              followUps: [...question.followUps, { id: Date.now(), author: "Anonymous attendee", body: trimmed }],
            }
          : question,
      ),
    );
  }

  function setQuestionStatus(questionId: number, status: QuestionStatus) {
    setQuestions((current) =>
      current.map((question) => (question.id === questionId ? { ...question, status } : question)),
    );
  }

  function setQuestionPriority(questionId: number, priority: QuestionPriority) {
    setQuestions((current) =>
      current.map((question) => (question.id === questionId ? { ...question, priority } : question)),
    );
  }

  function toggleHostPick(questionId: number) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? { ...question, priority: question.priority === "host_pick" ? "community" : "host_pick" }
          : question,
      ),
    );
  }

  function publishAnswer(questionId: number, delayed: boolean) {
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
                  id: Date.now(),
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
          submitQuestion={submitQuestion}
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
  submitQuestion,
  upvoteAnswer,
  upvoteQuestion,
}: {
  addFollowUp: (questionId: number, body: string) => void;
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
  submitQuestion: (event: FormEvent<HTMLFormElement>) => void;
  upvoteAnswer: (questionId: number, answerId: number) => void;
  upvoteQuestion: (questionId: number) => void;
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
  answerDrafts: Record<number, string>;
  publishAnswer: (questionId: number, delayed: boolean) => void;
  questions: Question[];
  setAnswerDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setQuestionStatus: (questionId: number, status: QuestionStatus) => void;
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
                  Delay
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
  questions,
  setQuestionPriority,
  setQuestionStatus,
  toggleHostPick,
}: {
  questions: Question[];
  setQuestionPriority: (questionId: number, priority: QuestionPriority) => void;
  setQuestionStatus: (questionId: number, status: QuestionStatus) => void;
  toggleHostPick: (questionId: number) => void;
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
  setQuestionStatus: (questionId: number, status: QuestionStatus) => void;
  stats: { open: number; delayed: number; answered: number; followUps: number; hostPicks: number };
  toggleHostPick: (questionId: number) => void;
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
}: {
  filter: Filter;
  questions: Question[];
  renderQuestion: (question: Question) => React.ReactNode;
  setFilter: (value: Filter) => void;
}) {
  return (
    <section className="question-column">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Community queue</p>
          <h2>Ranked questions</h2>
        </div>
        <div className="segmented" aria-label="Question filter">
          {(["top", "new", "open"] as Filter[]).map((option) => (
            <button
              className={filter === option ? "active" : ""}
              key={option}
              onClick={() => setFilter(option)}
              type="button"
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
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
  addFollowUp: (questionId: number, body: string) => void;
  question: Question;
  upvoteAnswer: (questionId: number, answerId: number) => void;
  upvoteQuestion: (questionId: number) => void;
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
      </div>
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
