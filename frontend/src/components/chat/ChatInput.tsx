import { useState } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="flex gap-2 p-3 border-t border-gray-200">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="Ask about products..."
        disabled={disabled}
        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !input.trim()}
        className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-900 disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
}
