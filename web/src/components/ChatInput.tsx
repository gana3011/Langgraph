import { RefObject } from "react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled: boolean;
  done: boolean;
  isQuestionMode: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function ChatInput({
  input,
  setInput,
  onSubmit,
  disabled,
  done,
  isQuestionMode,
  inputRef,
}: ChatInputProps) {
  return (
    <form
      className="flex gap-2 p-3 px-4 border-t border-gray-200 bg-white shrink-0"
      onSubmit={onSubmit}
    >
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={
          done
            ? "Triage complete."
            : isQuestionMode
            ? "Type your answer..."
            : "Describe your symptoms..."
        }
        disabled={disabled}
        className="flex-1 py-2.5 px-3.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="px-5 py-2.5 bg-blue-600 text-white border-none rounded-lg text-sm font-semibold cursor-pointer transition-colors hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed whitespace-nowrap"
      >
        Send
      </button>
    </form>
  );
}
