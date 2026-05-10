/**
 * Orion IDE — i18n Configuration
 * 
 * Initializes react-i18next with language detection and 18 locale files.
 * Will be implemented in a future task.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      // Additional languages will be added in locales/
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
