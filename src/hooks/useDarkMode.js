import { useEffect, useState } from 'react';

export default function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    // تفضيل النظام أول زيارة
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // طبق الثيم واحفظه وابث حدث مخصّص
  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    window.dispatchEvent(new CustomEvent('themechange', { detail: isDark }));
  }, [isDark]);

  // اسمع لأي تغيير من تبويب آخر أو من كومبوننت آخر
  useEffect(() => {
    const onThemeChange = (e) => setIsDark(e.detail);
    const onStorage = (e) => {
      if (e.key === 'theme') setIsDark(e.newValue === 'dark');
    };
    window.addEventListener('themechange', onThemeChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('themechange', onThemeChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return [isDark, setIsDark];
}
