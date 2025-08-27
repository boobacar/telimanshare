import { useState } from "react";
import SharePointSidebar from "./SharePointSidebar";
import SharePointHeader from "./SharePointHeader";

export default function SharePointLayout({ children, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f3f2f1] font-sans flex flex-col">
      <SharePointHeader user={user} onMenu={() => setSidebarOpen((o) => !o)} />
      <div className="flex flex-1">
        {/* Sidebar - visible MD+, drawer mobile */}
        <aside
          className={`fixed z-40 md:static top-0 left-0 h-full w-60 bg-[#f3f2f1] border-r border-gray-200
          ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } transition-transform duration-200`}
          style={{ minHeight: "100vh" }}
        >
          <SharePointSidebar />
        </aside>
        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Main */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)] md:pl-0 pl-0 pt-4 md:pt-8 px-2 sm:px-4">
          {children}
        </main>
      </div>
    </div>
  );
}
