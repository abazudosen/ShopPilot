import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "../../hooks/useChat";
import { useCart } from "../../hooks/useCart";
import type { Product } from "../../types/product";
import ChatMessageComponent from "./ChatMessage";
import ChatInput from "./ChatInput";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);
  const { messages, sendMessage, resolveAction, isLoading } = useChat({
    onCartAdd: (product) => {
      addToCart(product);
      setAddedFeedback(product.name);
      setTimeout(() => setAddedFeedback(null), 2000);
    },
    onCartRemove: (productId) => removeFromCart(productId),
    onCartUpdateQty: (productId, quantity) =>
      updateQuantity(productId, quantity),
    onNavigate: (path) => {
      setIsOpen(false);
      navigate(path);
    },
    getCart: () =>
      items.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity,
      })),
  });
  const { items, addToCart, removeFromCart, updateQuantity } = useCart();
  const navigate = useNavigate();

  function handleAddToCart(product: Product) {
    addToCart(product);
    setAddedFeedback(product.name);
    setTimeout(() => setAddedFeedback(null), 2000);
  }
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[400px] h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-700 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Shopping Assistant</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full" />
                  <span className="text-xs text-emerald-100">Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {addedFeedback && (
            <div className="bg-green-50 text-green-700 text-xs font-medium px-4 py-2 border-b border-green-100">
              Added {addedFeedback} to your cart
            </div>
          )}
          {/* Message list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <ChatMessageComponent
                key={i}
                message={msg}
                onAddToCart={handleAddToCart}
                onResolveAction={(id, confirm) =>
                  void resolveAction(id, confirm)
                }
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      )}
      {/* Tooltip label when closed */}
      {!isOpen && (
        <div className="pointer-events-none absolute bottom-16 right-0 hidden whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg sm:block">
          Ask AI Assistant
          <div className="absolute -bottom-1 right-5 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-800 text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-900 hover:shadow-xl hover:shadow-emerald-900/40 ${
          !isOpen ? "chat-ripple" : ""
        }`}
      >
        {isOpen ? (
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
      </button>
    </div>
  );
}
