// tailwind.config.js
module.exports = {
   darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#952D8C', // اللون الأساسي (البرتقالي الداكن)
        secondary: '#952D8C', // اللون الثانوي (البرتقالي الفاتح)
        accent: '#ffcc80', // لون مساعد لو محتاجة
        dark: '#1f2937', // خلفيات داكنة
        light: '#f9fafb', // خلفيات فاتحة
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        grayText: '#6b7280',
      },
    },
  },
  plugins: [],
};
