"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withTenant } from "../lib/navigation";

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
};

type ResearchChatProps = {
  tenantSlug: string;
  initialQuery?: string;
};

export function ResearchChat({ tenantSlug, initialQuery }: ResearchChatProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQuery ?? "");
  const [loading, setLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bootstrapped = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, statusLabel]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    const res = await fetch(`/api/research/${tenantSlug}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Research" }),
    });
    if (!res.ok) throw new Error("Failed to create research session");
    const data = (await res.json()) as { sessionId: string };
    setSessionId(data.sessionId);
    return data.sessionId;
  }, [sessionId, tenantSlug]);

  const consumeSseStream = useCallback(async (res: Response): Promise<{ assistantText: string; citations: string[] }> => {
    if (!res.body) throw new Error("No response body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantText = "";
    let citations: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const lines = part.split("\n");
        let event = "message";
        let dataLine = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) event = line.slice(7);
          if (line.startsWith("data: ")) dataLine = line.slice(6);
        }
        if (!dataLine) continue;
        try {
          const payload = JSON.parse(dataLine) as {
            content?: string;
            citations?: string[];
            message?: string;
            status?: string;
          };
          if (event === "status") {
            setStatusLabel(payload.status === "queued" ? "Queued…" : "Researching…");
          }
          if (event === "delta" && payload.content) {
            assistantText = payload.content;
            setStatusLabel(null);
          }
          if (event === "done" && payload.citations) {
            citations = payload.citations;
          }
          if (event === "error") {
            throw new Error(payload.message ?? "Agent error");
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    return { assistantText, citations };
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setError(null);
      setLoading(true);
      setStatusLabel(null);
      setMessages((m) => [...m, { role: "user", content: trimmed }]);
      setInput("");

      try {
        const sid = await ensureSession();
        const res = await fetch(`/api/research/${tenantSlug}/sessions/${sid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });

        if (res.status === 202) {
          const queued = (await res.json()) as { turnId: string };
          setStatusLabel("Queued…");
          const streamRes = await fetch(
            `/api/research/${tenantSlug}/sessions/${sid}/turns/${queued.turnId}/stream`
          );
          if (!streamRes.ok || !streamRes.body) {
            throw new Error(`Research stream failed (${streamRes.status})`);
          }
          const { assistantText, citations } = await consumeSseStream(streamRes);
          setMessages((m) => [
            ...m,
            { role: "assistant", content: assistantText || "(No response)", citations },
          ]);
          return;
        }

        if (!res.ok || !res.body) {
          throw new Error(`Research failed (${res.status})`);
        }

        const { assistantText, citations } = await consumeSseStream(res);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: assistantText || "(No response)", citations },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Research failed");
      } finally {
        setLoading(false);
        setStatusLabel(null);
      }
    },
    [consumeSseStream, ensureSession, loading, tenantSlug]
  );

  useEffect(() => {
    if (initialQuery && !bootstrapped.current) {
      bootstrapped.current = true;
      void sendMessage(initialQuery);
    }
  }, [initialQuery, sendMessage]);

  return (
    <div className="flex min-h-[420px] flex-col rounded-soft border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-stone-900">Research assistant</h2>
        <p className="mt-1 text-2xs text-muted">
          Market intelligence only. Public L2 sources. Never enter patient-identifiable information.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !loading ? (
          <p className="text-xs text-muted">Ask about drugs, trials, regulatory updates, or competitive landscape.</p>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-soft px-3 py-2 text-xs ${
              m.role === "user" ? "ml-8 bg-stone-100 text-stone-800" : "mr-8 border border-border bg-white text-stone-800"
            }`}
          >
            <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{m.role}</div>
            <div className="whitespace-pre-wrap">{m.content}</div>
            {m.citations && m.citations.length > 0 ? (
              <ul className="mt-2 list-disc pl-4 text-2xs text-muted">
                {m.citations.map((c, j) => (
                  <li key={j}>
                    {c.startsWith("http") ? (
                      <a href={c} className="text-accent-green underline" target="_blank" rel="noreferrer">
                        {c}
                      </a>
                    ) : (
                      c
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {loading ? <p className="text-2xs text-muted">{statusLabel ?? "Researching…"}</p> : null}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-soft border border-border bg-white px-3 py-2 text-xs outline-none focus:border-accent-green/50"
          placeholder="Research question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-soft border border-accent-green/40 bg-accent-green/10 px-3 py-2 text-xs font-semibold text-accent-green disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export function deepResearchHref(tenantSlug: string, query: string): string {
  return withTenant("/research", tenantSlug, { q: query });
}
