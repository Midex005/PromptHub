import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';
import zhTW from './locales/zh-TW.json';
import ja from './locales/ja.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';

// Get system language
// 获取系统语言
const getSystemLanguage = (): string => {
  const lang = navigator.language.toLowerCase();
  if (lang === 'zh-tw' || lang === 'zh-hant') return 'zh-TW';
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('fr')) return 'fr';
  return 'en';
};

// Get saved language settings (read from zustand persist store)
// 获取保存的语言设置 (从 zustand persist store 读取)
const getSavedLanguage = (): string | null => {
  try {
    const stored = localStorage.getItem('prompthub-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.language || null;
    }
    return null;
  } catch {
    return null;
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      'zh-TW': { translation: zhTW },
      ja: { translation: ja },
      es: { translation: es },
      de: { translation: de },
      fr: { translation: fr },
    },
    lng: getSavedLanguage() || getSystemLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

// Change language
// 切换语言
export const changeLanguage = (lang: string) => {
  i18n.changeLanguage(lang);
};

export default i18n;
