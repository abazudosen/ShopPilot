import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import "./index.css";
import App from "./App.tsx";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.user;
      if (event.request) {
        delete event.request.data;
        delete event.request.query_string;
        if (event.request.url) {
          try {
            const url = new URL(event.request.url);
            url.search = "";
            url.hash = "";
            event.request.url = url.toString();
          } catch {
            event.request.url = event.request.url.split(/[?#]/, 1)[0];
          }
        }
        if (event.request.headers) {
          for (const header of Object.keys(event.request.headers)) {
            if (/authorization|cookie|token|password/i.test(header)) {
              event.request.headers[header] = "[Filtered]";
            }
          }
        }
      }
      return event;
    },
  });
}

const application = (
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

createRoot(document.getElementById("root")!).render(
  sentryDsn ? (
    <Sentry.ErrorBoundary
      fallback={
        <main className="p-8 text-center">
          The storefront encountered an error. Please refresh the page.
        </main>
      }
    >
      {application}
    </Sentry.ErrorBoundary>
  ) : (
    application
  ),
);
