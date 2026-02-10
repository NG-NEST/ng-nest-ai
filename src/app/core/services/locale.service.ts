import { Injectable, inject, signal } from '@angular/core';
import { XConfigService, XStorageService } from '@ng-nest/ui/core';
import {
  XI18nLanguage,
  XI18nProperty,
  XI18nService,
  en_US,
  zh_CN,
  de_DE,
  zh_TW,
  ru_RU,
  ko_KR,
  ja_JP,
  fr_FR
} from '@ng-nest/ui/i18n';
import { Platform } from '@angular/cdk/platform';
import { HttpClient } from '@angular/common/http';
import { map, of } from 'rxjs';
import { Title } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class AppLocaleService {
  langKey = 'XLang';
  storage = inject(XStorageService);
  i18n = inject(XI18nService);
  config = inject(XConfigService);
  title = inject(Title);
  platform = inject(Platform);
  http = inject(HttpClient);
  defaultLang = signal<XI18nLanguage>(this.i18n.getLocaleId());
  langs = signal(['zh_CN', 'en_US', 'de_DE', 'zh_TW', 'ru_RU', 'ko_KR', 'ja_JP', 'fr_FR']);
  cacheLangs = signal<{ [lang: string]: XI18nProperty }>({});

  get lang(): XI18nLanguage {
    let lg = this.storage.getLocal(this.langKey);
    if (!lg) {
      this.storage.setLocal(this.langKey, this.defaultLang());
      return this.defaultLang()!;
    }
    return lg;
  }

  set lang(value: string) {
    this.storage.setLocal(this.langKey, value);
  }

  constructor() {
    this.i18n.localeChange.subscribe((x) => {
      const { $title } = x;
      this.title.setTitle($title);
    });

    // Initialize default language from system locale
    this.initializeDefaultLanguage();
  }

  private async initializeDefaultLanguage(): Promise<void> {
    try {
      // Get system locale from Electron
      const systemLocale = await window.electronAPI.windowControls.getSystemLocale();

      const mappedLang = this.mapSystemLocaleToSupportedLanguage(systemLocale);
      this.defaultLang.set(mappedLang);
    } catch (error) {
      console.warn('Failed to get system locale, using default:', error);
      // Keep the existing default if Electron API fails
    }
  }

  private mapSystemLocaleToSupportedLanguage(systemLocale: string): XI18nLanguage {
    // Map system locale to supported languages
    const localeMap: { [key: string]: XI18nLanguage } = {
      'zh-CN': 'zh_CN',
      'zh-TW': 'zh_TW',
      'zh-HK': 'zh_TW', // Use Traditional Chinese for Hong Kong
      en: 'en_US',
      'en-US': 'en_US',
      'en-GB': 'en_US', // Use US English for British English
      de: 'de_DE',
      'de-DE': 'de_DE',
      ru: 'ru_RU',
      'ru-RU': 'ru_RU',
      ko: 'ko_KR',
      'ko-KR': 'ko_KR',
      ja: 'ja_JP',
      'ja-JP': 'ja_JP',
      fr: 'fr_FR',
      'fr-FR': 'fr_FR'
    };

    // Try exact match first
    if (localeMap[systemLocale]) {
      return localeMap[systemLocale];
    }

    // Try language code only (e.g., 'zh' from 'zh-CN')
    const languageCode = systemLocale.split('-')[0];
    if (localeMap[languageCode]) {
      return localeMap[languageCode];
    }

    // Default to English if no match found
    return 'en_US';
  }

  init() {
    return this.setLocale();
  }

  setLocale(lang?: XI18nLanguage) {
    if (!lang) lang = this.lang;

    if (this.cacheLangs()[lang]) {
      this.lang = lang as string;
      this.i18n.setLocale(this.cacheLangs()[lang], true);
      return of(true);
    } else {
      let url = `./assets/i18n/${lang}.json`;
      return this.http.get<XI18nProperty>(url).pipe(
        map((x) => {
          this.lang = lang as string;
          const localeProps = this.setLocaleProps(x, this.lang);
          this.i18n.setLocale(localeProps, true);
          this.cacheLangs()[this.lang] = localeProps;
          return true;
        })
      );
    }
  }

  private setLocaleProps(locale: XI18nProperty, lang: string): XI18nProperty {
    if (lang === 'zh_CN') {
      return { ...zh_CN, ...locale };
    } else if (lang === 'en_US') {
      return { ...en_US, ...locale };
    } else if (lang === 'de_DE') {
      return { ...de_DE, ...locale };
    } else if (lang === 'zh_TW') {
      return { ...zh_TW, ...locale };
    } else if (lang === 'ru_RU') {
      return { ...ru_RU, ...locale };
    } else if (lang === 'ko_KR') {
      return { ...ko_KR, ...locale };
    } else if (lang === 'ja_JP') {
      return { ...ja_JP, ...locale };
    } else if (lang === 'fr_FR') {
      return { ...fr_FR, ...locale };
    } else {
      return { ...en_US, ...locale };
    }
  }
}
