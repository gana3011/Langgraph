"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

type Interrupt =
  | { type: "questions"; questions: string[] }
  | {
      type: "approval";
      symptoms: string[];
      red_flags: string[];
      urgency: string;
      reasoning: string;
      response: string;
    };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [interrupt, setInterrupt] = useState<Interrupt | null>(null);
  const [editUrgency, setEditUrgency] = useState("medium");
  const [editResponse, setEditResponse] = useState("");
  const [threadId] = useState(
    () => "patient-" + Math.random().toString(36).substring(7)
  );
  const [done, setDone] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interrupt, loading]);

  // After loading finishes, refocus the input
  useEffect(() => {
    if (!loading && interrupt?.type !== "approval") {
      inputRef.current?.focus();
    }
  }, [loading, interrupt]);

  const addAssistantMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
  };

  const handleApiResponse = (data: { state: any; interrupts: any[] }) => {
    // Rebuild full message list from state
    const stateMessages: Message[] = (data.state.messages ?? []).map(
      (m: any) => ({
        role: m.type === "human" ? "user" : "assistant",
        content: m.content,
      })
    );

    if (data.interrupts.length > 0) {
      const raw = data.interrupts[0];

      if ("questions" in raw) {
        // Show questions as an agent message in the chat
        const questionText =
          raw.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n");
        setMessages([
          ...stateMessages,
          { role: "assistant", content: questionText },
        ]);
        setInterrupt({ type: "questions", questions: raw.questions });
      } else if ("response" in raw) {
        setMessages(stateMessages);
        setInterrupt({
          type: "approval",
          symptoms: raw.symptoms,
          red_flags: raw.red_flags,
          urgency: raw.urgency,
          reasoning: raw.reasoning,
          response: raw.response,
        });
        setEditUrgency(raw.urgency);
        setEditResponse(raw.response);
      }
    } else {
      setInterrupt(null);
      setDone(true);
      const finalResponse = data.state.final_response;
      const alreadyShown = stateMessages.some(
        (m) => m.role === "assistant" && m.content === finalResponse
      );
      setMessages(
        alreadyShown || !finalResponse
          ? stateMessages
          : [...stateMessages, { role: "assistant", content: finalResponse }]
      );
    }
  };

  const callApi = async (body: object) => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, ...body }),
      });
      if (!res.ok) throw new Error(await res.text());
      handleApiResponse(await res.json());
    } catch (err) {
      console.error(err);
      addAssistantMessage("⚠️ Error contacting the server. Is the API running?");
    } finally {
      setLoading(false);
    }
  };

  // Single submit handler — routes to correct resume or initial message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    // Add user bubble immediately
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    if (interrupt?.type === "questions") {
      // Resume the graph with the user's plain-string answer
      setInterrupt(null);
      await callApi({ resume: text });
    } else {
      // Fresh message
      await callApi({ message: text });
    }
  };

  const submitApproval = async (approve: boolean) => {
    setInterrupt(null);
    const resume = approve
      ? { approve: true }
      : { approve: false, urgency: editUrgency, response: editResponse };
    await callApi({ resume });
  };

  const inputDisabled = loading || interrupt?.type === "approval" || done;

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <span className="header-icon">🏥</span>
        <div>
          <h1>Medical Triage Agent</h1>
          <p>Describe your symptoms to get started</p>
        </div>
      </header>

      {/* Chat area */}
      <main className="chat-area">
        {messages.length === 0 && !loading && (
          <div className="empty-state">
            <p>👋 Hello! Tell me your symptoms and I'll help assess your situation.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`row ${m.role}`}>
            <div className="avatar">{m.role === "user" ? "🧑" : "🤖"}</div>
            <div className="bubble">
              <span className="sender">{m.role === "user" ? "You" : "Agent"}</span>
              <p>{m.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="row assistant">
            <div className="avatar">🤖</div>
            <div className="bubble">
              <span className="sender">Agent</span>
              <p className="typing">
                <span /><span /><span />
              </p>
            </div>
          </div>
        )}

        {/* Human approval panel — shown inline in chat */}
        {!loading && interrupt?.type === "approval" && (
          <div className="row assistant">
            <div className="avatar">🩺</div>
            <div className="approval-panel">
              <h3>Human Review Required</h3>

              <div className="info-grid">
                <div>
                  <strong>Symptoms</strong>
                  <ul>
                    {interrupt.symptoms.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <strong>Red Flags</strong>
                  <ul>
                    {interrupt.red_flags.length === 0
                      ? <li className="muted">None detected</li>
                      : interrupt.red_flags.map((f, i) => <li key={i} className="danger">{f}</li>)
                    }
                  </ul>
                </div>
              </div>

              <label>
                Urgency
                <select value={editUrgency} onChange={(e) => setEditUrgency(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label>
                Reasoning
                <span className="reasoning">{interrupt.reasoning}</span>
              </label>

              <label>
                Response to Patient
                <textarea
                  value={editResponse}
                  onChange={(e) => setEditResponse(e.target.value)}
                  rows={4}
                />
              </label>

              <div className="approval-btns">
                <button className="btn-approve" onClick={() => submitApproval(true)}>
                  ✅ Approve
                </button>
                <button className="btn-edit" onClick={() => submitApproval(false)}>
                  ✏️ Edit &amp; Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {done && !interrupt && (
          <p className="done-badge">✓ Triage complete</p>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Single input bar */}
      <form className="input-bar" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            done
              ? "Triage complete."
              : interrupt?.type === "questions"
              ? "Type your answer..."
              : "Describe your symptoms..."
          }
          disabled={inputDisabled}
        />
        <button type="submit" disabled={inputDisabled || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
