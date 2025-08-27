// tailwind.config.js
module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // adapte si tes fichiers sont ailleurs
  ],
  theme: {
    extend: {
      animation: {
        "fade-in": "fadeIn .3s cubic-bezier(.45,.9,.45,1) both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },

  plugins: [],
};
