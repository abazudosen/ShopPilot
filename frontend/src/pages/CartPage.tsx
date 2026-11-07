import { Link } from "react-router-dom";
import { useCart } from "../hooks/useCart";

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, totalItems, totalPrice } =
    useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Your cart is empty</h1>
        <Link
          to="/"
          className="inline-block mt-6 rounded-lg bg-emerald-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-900"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-10 grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-4">
        {items.map((item) => (
          <div
            key={item.product.id}
            className="flex items-center gap-4 bg-white border border-gray-100 rounded-lg p-4"
          >
            <img
              src={item.product.image}
              alt={item.product.name}
              className="w-20 h-20 object-cover rounded"
            />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{item.product.name}</p>
              <span className="text-sm text-gray-500">
                ${item.product.price.toFixed(2)}
              </span>
            </div>
            <button
              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
              className="w-8 h-8 border rounded"
            >
              -
            </button>
            <span className="w-6 text-center">{item.quantity}</span>
            <button
              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
              className="w-8 h-8 border rounded"
            >
              +
            </button>
            <button
              onClick={() => removeFromCart(item.product.id)}
              className="text-sm text-red-500"
            >
              remove
            </button>
            <span className="w-20 text-right font-semibold">
              ${(item.product.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-100 rounded-lg p-6 h-fit">
        <h2 className="font-bold text-gray-900">Order Summary</h2>
        <p className="mt-4 flex justify-between text-sm">
          <span>Items ({totalItems})</span>
          <span>${totalPrice.toFixed(2)}</span>
        </p>
        <Link
          to="/checkout"
          className="mt-6 block rounded-lg bg-emerald-800 py-3 text-center font-semibold text-white transition-colors hover:bg-emerald-900"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}
