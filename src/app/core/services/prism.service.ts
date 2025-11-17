import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { XIsArray } from '@ng-nest/ui';
import { XIsString } from '@ng-nest/ui/core';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppPrismService {
  platformId = inject(PLATFORM_ID);
  isBrowser = isPlatformBrowser(this.platformId);
  prism = this.isBrowser ? (window as any)['Prism'] : null;
  private loadedLanguages = new Set<string>();

  // 预定义支持的语言导入函数
  private readonly languageLoaders: Record<string, () => Promise<any>> = {
    javascript: () => import('prismjs/components/prism-javascript.js?esm' as any),
    typescript: () => import('prismjs/components/prism-typescript.js?esm' as any),
    css: () => import('prismjs/components/prism-css.js?esm' as any),
    scss: () => import('prismjs/components/prism-scss.js?esm' as any),
    json: () => import('prismjs/components/prism-json.js?esm' as any),
    bash: () => import('prismjs/components/prism-bash.js?esm' as any),
    markdown: () => import('prismjs/components/prism-markdown.js?esm' as any),
    markup: () => import('prismjs/components/prism-markup.js?esm' as any),
    html: () => import('prismjs/components/prism-markup.js?esm' as any),
    xml: () => import('prismjs/components/prism-markup.js?esm' as any),
    python: () => import('prismjs/components/prism-python.js?esm' as any),
    java: () => import('prismjs/components/prism-java.js?esm' as any),
    go: () => import('prismjs/components/prism-go.js?esm' as any),
    rust: () => import('prismjs/components/prism-rust.js?esm' as any),
    sql: () => import('prismjs/components/prism-sql.js?esm' as any),
    yaml: () => import('prismjs/components/prism-yaml.js?esm' as any),
    docker: () => import('prismjs/components/prism-docker.js?esm' as any),
    git: () => import('prismjs/components/prism-git.js?esm' as any),
    vue: () => import('prismjs/components/prism-javascript.js?esm' as any),
    jsx: () => import('prismjs/components/prism-javascript.js?esm' as any),
    tsx: () => import('prismjs/components/prism-typescript.js?esm' as any),
    csharp: () => import('prismjs/components/prism-csharp.js?esm' as any),
    c: () => import('prismjs/components/prism-c.js?esm' as any),

  };

  init() {
    if (!this.prism) return of(true);
    const checkString = (str: string) => {
      const regex = /^(['"`])(.*?)\1$/;
      return regex.test(str);
    };
    const checkInputOutput = (str: string) => {
      const regex = /^(\[[^\]]*\]|\([^)]*\))$/;
      return regex.test(str);
    };
    const checkTokens = (tokens: any[], handle: (token: any) => any) => {
      const result: any[] = [];
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const ts = handle(token);

        if (XIsArray(token.content)) {
          ts.content = checkTokens(token.content, handle);
        }

        result.push(ts);
      }
      return result;
    };
    this.prism.hooks.add('after-tokenize', (env: any) => {
      let { tokens, language } = env;
      if (language === 'typescript') {
        env.tokens = checkTokens(tokens, (token: any) => {
          if (XIsString(token)) {
            const tstring = token.trim();
            let name = 'property';
            if (checkString(tstring)) {
              name = 'string';
            }
            return new this.prism.Token(name, token);
          } else {
            return token;
          }
        });
      } else if (language === 'html') {
        env.tokens = checkTokens(tokens, (token: any) => {
          if (XIsString(token) && checkInputOutput(token)) {
            const start = token.slice(0, 1);
            const end = token.slice(token.length - 1);
            const newstr = token.slice(1, token.length - 1);
            return new this.prism.Token('attr-name', [
              new this.prism.Token('attr-equals', start),
              new this.prism.Token('attr-name', newstr),
              new this.prism.Token('attr-equals', end)
            ]);
          } else {
            return token;
          }
        });
      }
    });

    return of(true);
  }

  async loadPrism(): Promise<any> {
    if (!(window as any).Prism) {
      await import('prismjs' as any);
    }
    return (window as any).Prism;
  }

  async loadLanguage(language: string): Promise<void> {
    if (this.loadedLanguages.has(language)) {
      return;
    }

    const Prism = await this.loadPrism();

    // 使用预定义的加载器
    if (this.languageLoaders[language] && !Prism.languages[language]) {
      try {
        await this.languageLoaders[language]();
        this.loadedLanguages.add(language);
      } catch (error) {
        console.warn(`Failed to load Prism language: ${language}`, error);
      }
    } else if (Prism.languages[language]) {
      this.loadedLanguages.add(language);
    } else {
      // 对于未预定义的语言，可以选择忽略或使用动态导入（带 @vite-ignore）
      console.warn(`Unsupported language: ${language}`);
    }
  }

  highlight(code: string, language: string): string {
    const Prism = (window as any).Prism;
    if (Prism && Prism.languages[language]) {
      return Prism.highlight(code, Prism.languages[language], language);
    }
    return code;
  }

  /**
   * 处理包含代码块的 Markdown 文本
   * 使用正则表达式提取并高亮代码块
   */
  async processMarkdownWithCode(markdown: string): Promise<string> {
    // 代码块匹配正则表达式
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    // 检查是否存在代码块
    const hasCodeBlocks = codeBlockRegex.test(markdown);

    // 如果没有代码块，直接返回原始 Markdown
    if (!hasCodeBlocks) {
      return markdown;
    }

    // 重置 lastIndex 以准备第二次匹配
    codeBlockRegex.lastIndex = 0;

    // 收集所有需要的语言
    const languagePromises: Promise<void>[] = [];
    let match;

    // 第一次遍历：收集需要加载的语言
    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      const language = match[1] || 'markup';
      languagePromises.push(this.loadLanguage(language));
    }

    // 等待所有语言加载完成
    await Promise.all(languagePromises);

    // 加载 Prism 核心库
    await this.loadPrism();

    // 第二次遍历：替换代码块为高亮后的 HTML
    const processedMarkdown = markdown.replace(codeBlockRegex, (match, language, code) => {
      const lang = language || 'markup';
      const trimmedCode = code.trim();
      const highlightedCode = this.highlight(trimmedCode, lang);
      return `<pre class="language-${lang}"><code class="language-${lang}">${highlightedCode}</code></pre>`;
    });

    return processedMarkdown;
  }

  /**
   * 结合 micromark 解析完整的 Markdown 并处理代码高亮
   * 假设您已经用 micromark 将 Markdown 转换为 HTML
   */
  async highlightCodeInHtml(html: string): Promise<string> {
    // 匹配 HTML 中的代码块
    const codeBlockRegex = /<pre(?: class="([^"]*)")?><code(?: class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g;

    // 检查是否存在代码块
    const hasCodeBlocks = codeBlockRegex.test(html);

    // 如果没有代码块，直接返回原始 HTML
    if (!hasCodeBlocks) {
      return html;
    }

    // 重置 lastIndex 以准备第二次匹配
    codeBlockRegex.lastIndex = 0;

    // 收集需要的语言
    const languagePromises: Promise<void>[] = [];
    let match;

    // 第一次遍历：收集语言
    while ((match = codeBlockRegex.exec(html)) !== null) {
      const fullClass = match[1] || match[2] || '';
      const language = this.extractLanguageFromClass(fullClass) || 'markup';
      languagePromises.push(this.loadLanguage(language));
    }

    // 等待所有语言加载完成
    await Promise.all(languagePromises);

    // 加载 Prism 核心库
    await this.loadPrism();

    // 替换代码块内容
    const processedHtml = html.replace(codeBlockRegex, (match, preClass, codeClass, codeContent) => {
      const fullClass = preClass || codeClass || '';
      const language = this.extractLanguageFromClass(fullClass) || 'markup';

      // 解码 HTML 实体（如果需要）
      const decodedCode = this.decodeHtmlEntities(codeContent);
      const highlightedCode = this.highlight(decodedCode, language);

      const langClass = `language-${language}`;
      const buttons = [
        `<button class="button copy-text" data-copy-text="${this.escapeQuotes(decodedCode)}">复制</button>`
      ];
      if (language === 'html') {
        buttons.unshift(
          `<button class="button preview-html" data-preview-html="${this.escapeQuotes(decodedCode)}">预览</button>`
        );
      }

      return `
        <div class="code-block-wrapper">
          <pre class="${langClass}"><code class="${langClass}">${highlightedCode}</code></pre>
          <div class="code-block-actions">
            ${buttons.join('')}
          </div>
        </div>
      `;
    });

    return processedHtml;
  }

  /**
   * 转义引号以避免 HTML 属性中的问题
   */
  private escapeQuotes(text: string): string {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * 复制文本到剪贴板
   */
  copyToClipboard(text: string): Promise<void> {
    if (!this.isBrowser) {
      return Promise.resolve();
    }

    if (navigator.clipboard && window.isSecureContext) {
      // 使用现代 Clipboard API
      return navigator.clipboard.writeText(text);
    } else {
      // 降级到传统方法
      return this.fallbackCopyTextToClipboard(text);
    }
  }

  /**
   * 传统复制方法（兼容旧浏览器）
   */
  private fallbackCopyTextToClipboard(text: string): Promise<void> {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // 避免滚动到底部
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    return new Promise((resolve, reject) => {
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          resolve();
        } else {
          reject(new Error('Failed to copy text'));
        }
      } catch (err) {
        document.body.removeChild(textArea);
        reject(err);
      }
    });
  }

  /**
   * 从 class 属性中提取语言信息
   */
  private extractLanguageFromClass(classAttr: string): string | null {
    if (!classAttr) return null;

    const languageMatch = classAttr.match(/language-(\w+)/);
    return languageMatch ? languageMatch[1] : null;
  }

  /**
   * 解码 HTML 实体
   */
  private decodeHtmlEntities(text: string): string {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
  }
}
