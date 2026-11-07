import Header from "./Header";
import ChatWidget from "../chat/ChatWidget";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Header />
      <main>{children}</main>
      <ChatWidget />
    </div>
  );
}
