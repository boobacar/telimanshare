// src/components/SharePointLayout.jsx
import { useState } from "react";
import SharePointSidebar from "./SharePointSidebar";
import SharePointHeader from "./SharePointHeader";
import camions from "../assets/camions.jpeg";
export default function SharePointLayout({ children, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#f3f2f1] font-sans flex flex-col">
      {/* Fond visuel couvrant tout le layout, calé sur sa hauteur */}
      <div
        className="pointer-events-none absolute inset-x-0 top-14 bottom-0 bg-no-repeat bg-cover bg-center opacity-50"
        style={{ backgroundImage: `url(${camions})` }}
      />
      <SharePointHeader user={user} onMenu={() => setSidebarOpen((o) => !o)} />
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`fixed z-40 md:static top-0 left-0 h-full w-60 bg-[#f3f2f1] border-r border-gray-200
          ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }
          transition-transform duration-200`}
          style={{ minHeight: "100vh" }}
        >
          <SharePointSidebar user={user} />
        </aside>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main */}
        <main className="flex-1 min-w-0 pt-4 md:pt-8 px-2 sm:px-4 w-full">
          <div className="max-w-screen-xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
