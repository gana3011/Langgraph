import { Message } from "../types";

export function MessageList({
  messages,
  loading,
}: {
  messages: Message[];
  loading: boolean;
}) {
  return (
    <>
      {messages.length === 0 && !loading && (
        <div className="m-auto text-gray-400 text-center text-[0.95rem] p-5">
          <p>👋 Hello! Tell me your symptoms and I'll help assess your situation.</p>
        </div>
      )}

      {messages
        .filter((m) => !m.content.startsWith("System Log:"))
        .map((m, i) => (
        <div
          key={i}
          className={`flex gap-2.5 max-w-[85%] ${
            m.role === "user" ? "self-end flex-row-reverse" : "self-start"
          }`}
        >
          <div className="text-2xl shrink-0 w-9 h-9 flex items-center justify-center">
            {m.role === "user" ? "🧑" : "🤖"}
          </div>
          <div className="flex flex-col gap-1">
            <span
              className={`text-[0.72rem] font-semibold uppercase tracking-wider text-gray-400 ${
                m.role === "user" ? "text-right" : "text-left"
              }`}
            >
              {m.role === "user" ? "You" : "Agent"}
            </span>
            <p
              className={`p-2.5 px-3.5 rounded-2xl text-[0.93rem] leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-900 rounded-bl-sm"
              }`}
            >
              {m.content}
            </p>
          </div>
        </div>
      ))}

      {loading && (
        <div className="flex gap-2.5 max-w-[85%] self-start">
          <div className="text-2xl shrink-0 w-9 h-9 flex items-center justify-center">
            🤖
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[0.72rem] font-semibold uppercase tracking-wider text-gray-400 text-left">
              Agent
            </span>
            <div className="p-3 px-4 rounded-2xl rounded-bl-sm bg-gray-100 text-gray-900 flex items-center gap-1.5 h-[42px]">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
