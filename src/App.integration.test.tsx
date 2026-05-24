import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "./main";

vi.mock("./supabase", () => ({
  hasSupabaseConfig: false,
  supabase: null,
}));

describe("Lagoa Q&A UI integration", () => {
  it("lets an attendee submit a tagged question and discover it in the New queue", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.clear(screen.getByLabelText("Question text"));
    await user.type(screen.getByLabelText("Question text"), "How do we include async attendees in the recap?");
    await user.type(screen.getByLabelText("Question tags"), "Recap, Async attendees");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("heading", { name: "How do we include async attendees in the recap?" })).toBeVisible();
    expect(screen.getAllByText("Recap").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Async attendees").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "New" })).toHaveClass("active");
  });

  it("switches role workspaces without losing the shared question queue", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Speaker/ }));
    expect(screen.getByRole("heading", { name: "Questions to answer" })).toBeVisible();
    expect(screen.getByText("Speaker focus")).toBeVisible();
    expect(screen.getByText("What signals tell you that a live Q&A is missing important questions from the room?")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Organizer/ }));
    expect(screen.getByRole("heading", { name: "Designing calmer AI product launches" })).toBeVisible();
    expect(screen.getByText("Queue health")).toBeVisible();
  });

  it("lets an assistant add a moderation tag that appears on the question card", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Assistant/ }));

    const moderationCard = screen
      .getByRole("heading", {
        name: "What signals tell you that a live Q&A is missing important questions from the room?",
      })
      .closest("article");

    expect(moderationCard).not.toBeNull();
    fireEvent.change(within(moderationCard as HTMLElement).getByLabelText("Add moderation tag"), {
      target: { value: "Quiet cue" },
    });
    await user.click(within(moderationCard as HTMLElement).getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Quiet cue")).toBeVisible();
  });

  it("lets a speaker schedule a delayed recap answer and exposes the attendee return cue", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Speaker/ }));

    const speakerCard = screen
      .getByRole("heading", {
        name: "What signals tell you that a live Q&A is missing important questions from the room?",
      })
      .closest("article");

    expect(speakerCard).not.toBeNull();
    fireEvent.change(
      within(speakerCard as HTMLElement).getByLabelText(
        "Answer What signals tell you that a live Q&A is missing important questions from the room?",
      ),
      {
        target: { value: "We will include patterns from unanswered questions in the post-webinar recap." },
      },
    );
    await user.click(within(speakerCard as HTMLElement).getByRole("button", { name: "Schedule recap" }));

    await user.click(screen.getByRole("button", { name: /Attendee/ }));
    await user.click(screen.getByRole("button", { name: "Late" }));

    const scheduledResponses = screen.getAllByRole("status", { name: "Scheduled response" });
    expect(scheduledResponses.length).toBeGreaterThan(0);
    expect(scheduledResponses.at(-1)).toHaveTextContent(
      "Scheduled response. Attendees should check back after the webinar",
    );
    expect(screen.getByText("Scheduled after webinar")).toBeVisible();
  });
});
