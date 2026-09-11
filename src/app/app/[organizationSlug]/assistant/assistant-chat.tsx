"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string; }

const SUGGESTED = [
  "How did we do this month?",
  "How much can we safely distribute?",
  "Which invoices need attention?",
  "Explain my tax reserve.",
  "Which clients generate the most revenue?",
  "Are expenses increasing?",
];

export function AssistantChat({ organizationSlug }: { organizationSlug: string }) {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [pending, setPending] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | undefined>();
  const [input, setInput] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  const scrollBottom = () =>
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 30);

  async function send(message: string) {
    if (!message.trim() || pending) return;
    setPending(true);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    scrollBottom();
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationSlug, conversationId, message }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Assistant failed.");
      }
      const data = await res.json();
      setConversationId(data.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: data.answer || "…" }]);
      scrollBottom();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-surface">
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="mx-auto max-w-2xl px-6 py-16 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-md">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">Ask about your business</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              I only see aggregated numbers for this workspace. I&apos;ll flag tax-related answers as planning estimates.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="group flex items-center gap-2 rounded-lg border border-border/70 bg-surface p-3 text-left text-sm transition-colors hover:border-border-strong hover:bg-surface-hover"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="flex-1 text-left text-foreground">{s}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} />
            ))}
            {pending && <Bubble role="assistant" content="Thinking…" pending />}
          </div>
        )}
      </div>

      <form
        className="mx-auto w-full max-w-3xl border-t border-border/70 p-4"
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
      >
        <div className="relative rounded-xl border border-border bg-surface shadow-xs transition-colors focus-within:border-primary">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about revenue, invoices, cash, taxes, or distributions…"
            rows={2}
            className="resize-none border-0 pr-14 shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={pending || !input.trim()}
            className="absolute bottom-2 right-2 h-8 w-8"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mt-2 text-center text-2xs text-muted-foreground">
          Enter to send · Shift + Enter for a new line · Tax numbers are planning estimates
        </p>
      </form>
    </div>
  );
}

function Bubble({ role, content, pending }: { role: "user" | "assistant"; content: string; pending?: boolean }) {
  const isUser = role === "user";
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full",
          isUser
            ? "bg-secondary text-secondary-foreground"
            : "bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-sm",
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
          {isUser ? "You" : "LedgerFlow"}
        </div>
        <div
          className={cn(
            "mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground",
            pending && "animate-pulse text-muted-foreground",
          )}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
