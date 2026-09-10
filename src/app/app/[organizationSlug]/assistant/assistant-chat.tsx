"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string; }

const SUGGESTED = [
  "How did we do this month?",
  "How much can we safely distribute?",
  "Which invoices need attention?",
  "Are our expenses increasing?",
  "Which clients generate the most revenue?",
  "Explain my tax reserve.",
  "What is our projected annual revenue?",
  "Summarize the business for this month.",
];

export function AssistantChat({ organizationSlug }: { organizationSlug: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  async function send(message: string) {
    if (!message.trim() || pending) return;
    setPending(true);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
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
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 10);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mt-4 flex h-[72vh] flex-col">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> Ask about your business</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-0">
        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground">Try one of these:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border bg-secondary/50 px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-line",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                )}>
                  {m.content}
                </div>
              </div>
            ))
          )}
          {pending && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">Thinking…</div>
            </div>
          )}
        </div>
        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(e) => { e.preventDefault(); void send(input); }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about revenue, invoices, cash, or taxes…"
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <Button type="submit" disabled={pending || !input.trim()}>
            <Send className="h-4 w-4" /> Ask
          </Button>
        </form>
        <p className="border-t p-2 text-center text-xs text-muted-foreground">
          Tax numbers are planning estimates. Not tax, legal, or accounting advice.
        </p>
      </CardContent>
    </Card>
  );
}
