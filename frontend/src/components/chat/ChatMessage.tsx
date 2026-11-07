import { Link } from "react-router-dom";
import type { ChatMessage as Message } from "../../types/chat";
import type { Product } from "../../types/product";

interface Props {
  message: Message;
  onAddToCart?: (product: Product) => void;
  onResolveAction?: (id: string, confirm: boolean) => void;
}

export default function ChatMessage({
  message,
  onAddToCart,
  onResolveAction,
}: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-800">
          <svg
            className="w-3.5 h-3.5 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      )}
      <div className="max-w-[85%]">
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "rounded-br-sm bg-emerald-800 text-white"
              : "bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100"
          }`}
        >
          {message.content || (
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.15s]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.3s]" />
            </span>
          )}
        </div>
        {message.products && message.products.length > 0 && (
          <div className="space-y-2 mt-2">
            {message.products.map((product) => (
              <ProductMiniCard
                key={product.id}
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        )}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.citations.map((citation) => (
              <a
                key={citation.id}
                href={citation.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
                title={`${citation.category}: ${citation.title}`}
              >
                [{citation.id}] {citation.title}
              </a>
            ))}
          </div>
        )}
        {message.confirmation && (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">
              {message.confirmation.summary}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Expires{" "}
              {new Date(message.confirmation.expiresAt).toLocaleTimeString()}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() =>
                  onResolveAction?.(message.confirmation!.id, true)
                }
                className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
              >
                Confirm
              </button>
              <button
                onClick={() =>
                  onResolveAction?.(message.confirmation!.id, false)
                }
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                No, cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductMiniCard({
  product,
  onAddToCart,
}: {
  product: Product;
  onAddToCart?: (product: Product) => void;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
      <div className="flex gap-3">
        <img
          src={product.image}
          alt={product.name}
          className="w-16 h-16 object-contain rounded-lg bg-gray-50"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {product.name}
          </p>
          <p className="text-xs text-amber-500">
            ★ {product.rating.toFixed(1)}
          </p>
          <p className="text-sm font-bold text-gray-900">
            ${product.price.toFixed(2)}
          </p>
          <p
            className={`text-xs ${product.inStock ? "text-green-600" : "text-red-500"}`}
          >
            {product.inStock ? "In stock" : "Out of stock"}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Link
          to={`/product/${product.id}`}
          className="flex-1 text-center text-xs font-medium border border-gray-200 rounded-lg py-1.5"
        >
          More Details
        </Link>
        <button
          onClick={() => onAddToCart?.(product)}
          disabled={!product.inStock}
          className="flex-1 rounded-lg bg-emerald-800 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
