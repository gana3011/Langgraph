"use client";

import { useState, useRef, useEffect } from "react";
import { Message, Interrupt } from "../types";
import { Header } from "../components/Header";
import { ChatInput } from "../components/ChatInput";
import { MessageList } from "../components/MessageList";
import { ApprovalPanel } from "../components/ApprovalPanel";

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

  useEffect(() => {
    if (!loading && interrupt?.type !== "approval") {
      inputRef.current?.focus();
    }
  }, [loading, interrupt]);

  const addAssistantMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
  };

  const handleApiResponse = (data: { state: any; interrupts: any[] }) => {
    const stateMessages: Message[] = (data.state.messages ?? []).map(
      (m: any) => ({
        role: m.type === "human" ? "user" : "assistant",
        content: m.content,
      })
    );

    if (data.interrupts.length > 0) {
      const raw = data.interrupts[0];

      if ("questions" in raw) {
        const questionText = raw.questions
          .map((q: string, i: number) => `${i + 1}. ${q}`)
          .join("\n");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    setMessages((prev) => [...prev, { role: "user", content: text }]);

    if (interrupt?.type === "questions") {
      setInterrupt(null);
      await callApi({ resume: text });
    } else {
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
    <div className="flex flex-col w-full max-w-[700px] h-screen bg-white shadow-[0_0_40px_rgba(0,0,0,0.1)]">
      <Header />

      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <MessageList messages={messages} loading={loading} />

        {!loading && interrupt?.type === "approval" && (
          <ApprovalPanel
            interrupt={interrupt}
            editUrgency={editUrgency}
            setEditUrgency={setEditUrgency}
            editResponse={editResponse}
            setEditResponse={setEditResponse}
            submitApproval={submitApproval}
          />
        )}

        {done && !interrupt && (
          <p className="text-center text-[0.82rem] font-semibold text-green-600 p-1">
            ✓ Triage complete
          </p>
        )}

        <div ref={bottomRef} />
      </main>

      <ChatInput
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        disabled={inputDisabled}
        done={done}
        isQuestionMode={interrupt?.type === "questions"}
        inputRef={inputRef}
      />
    </div>
  );
}
