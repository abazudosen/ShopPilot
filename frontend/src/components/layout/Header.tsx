import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();

  function handleSearch() {
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <header className="sticky top-0 z-20 bg-white shadow-sm">
      {/* Announcement bar */}
      <div className="bg-gray-900 text-gray-300">
        <div className="max-w-[1280px] mx-auto px-6 h-9 flex items-center justify-center gap-2 text-[11px] font-medium tracking-wide">
          <svg
            className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="truncate">
            Local demo storefront · Stripe test payments only · No live charges
          </span>
        </div>
      </div>

      {/* Main bar: Logo · Search · Nav */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1280px] mx-auto px-6 h-[68px] flex items-center gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-teal-500 shadow-sm shadow-emerald-900/25">
              <span className="h-3 w-3 rounded-full bg-lime-200" />
            </span>
            <span className="text-[18px] font-bold tracking-tight text-slate-950">
              Shop<span className="text-emerald-800">Pilot</span>
            </span>
          </Link>

          {/* Search bar */}
          <div className="flex-1">
            <div className="flex h-[44px] overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search for products, brands and more..."
                className="flex-1 border-0 pl-5 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none bg-transparent"
              />
              <button
                onClick={handleSearch}
                aria-label="Search"
                className="flex w-[54px] flex-shrink-0 items-center justify-center bg-emerald-800 text-white transition-colors hover:bg-emerald-900"
              >
                <svg
                  className="w-[18px] h-[18px]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1 flex-shrink-0">
            {user ? (
              <>
                <div className="flex items-center gap-2 pr-1">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold uppercase text-emerald-800">
                    {user.name.charAt(0)}
                  </span>
                  <span className="text-gray-800 text-sm font-semibold max-w-[120px] truncate">
                    {user.name}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-gray-900 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 hover:text-emerald-800"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-900/20 transition-colors hover:bg-emerald-900"
                >
                  Sign Up
                </Link>
              </>
            )}
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `h-[44px] flex items-center px-3 text-sm transition-colors ${
                  isActive
                    ? "font-semibold text-emerald-800"
                    : "font-medium text-gray-600 hover:text-emerald-800"
                }`
              }
            >
              Home
            </NavLink>
          </nav>
          <Link
            to="/cart"
            className="relative flex-shrink-0 p-2 text-gray-700 hover:text-emerald-800"
          >
            <svg
              className="w-[22px] h-[22px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
              />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-800 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
