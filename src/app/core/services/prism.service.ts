import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { XIsArray } from '@ng-nest/ui';
import { XIsString } from '@ng-nest/ui/core';
import { of } from 'rxjs';
import * as prettier from 'prettier/standalone';
import * as prettierBabel from 'prettier/plugins/babel';
import * as prettierEstree from 'prettier/plugins/estree';
import * as prettierHtml from 'prettier/plugins/html';
import * as prettierCss from 'prettier/plugins/postcss';
import * as prettierTypescript from 'prettier/plugins/typescript';
import { Options } from 'prettier';

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
    c: () => import('prismjs/components/prism-c.js?esm' as any)
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
    }
    //else {
    // 对于未预定义的语言，可以选择忽略或使用动态导入（带 @vite-ignore）
    // console.warn(`Unsupported language: ${language}`);
    //}
  }

  highlight(code: string, language: string): string {
    const Prism = (window as any).Prism;
    if (Prism && Prism.languages[language]) {
      return Prism.highlight(code, Prism.languages[language], language);
    }
    return code;
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
    const matches: RegExpExecArray[] = [];
    let match;

    // 第一次遍历：收集语言和匹配项
    while ((match = codeBlockRegex.exec(html)) !== null) {
      matches.push(match);
      const fullClass = match[1] || match[2] || '';
      const language = this.extractLanguageFromClass(fullClass) || 'markup';
      languagePromises.push(this.loadLanguage(language));
    }

    // 等待所有语言加载完成
    await Promise.all(languagePromises);

    // 加载 Prism 核心库
    await this.loadPrism();

    // 创建新的 HTML 内容
    let processedHtml = html;

    // 逐个处理每个代码块
    for (const match of matches) {
      const [fullMatch, preClass, codeClass, codeContent] = match;
      const fullClass = preClass || codeClass || '';
      const language = this.extractLanguageFromClass(fullClass) || 'markup';

      // 解码 HTML 实体
      const decodedCode = this.decodeHtmlEntities(codeContent);

      // 使用 Prettier 格式化代码
      const formattedCode = await this.formatWithPrettier(decodedCode, language);

      // 使用 Prism 高亮格式化后的代码
      const highlightedCode = this.highlight(formattedCode, language);

      const langClass = `language-${language}`;
      const buttons = [
        `<button class="button copy-text" data-copy-text="${this.escapeQuotes(formattedCode)}">复制</button>`
      ];
      if (language === 'html') {
        buttons.unshift(
          `<button class="button preview-html" data-preview-html="${this.escapeQuotes(formattedCode)}">预览</button>`
        );
      }

      const replacement = `
      <div class="code-block-wrapper">
        <pre class="${langClass}"><code class="${langClass}">${highlightedCode}</code></pre>
        <div class="code-block-actions">
          ${buttons.join('')}
        </div>
      </div>
    `;

      // 替换当前匹配项
      processedHtml = processedHtml.replace(fullMatch, replacement);
    }

    return processedHtml;
  }

  /**
   * 使用 Prettier 格式化代码
   */
  private async formatWithPrettier(code: string, language: string): Promise<string> {
    try {
      // 根据语言确定 Prettier 配置
      const options: Options = {
        parser: this.getPrettierParser(language)!,
        plugins: [prettierBabel, prettierEstree as any, prettierHtml, prettierCss, prettierTypescript],
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: true,
        trailingComma: 'none'
      };

      // 如果无法识别语言，则不格式化
      if (!options.parser) {
        return code;
      }

      // 执行格式化
      return await prettier.format(code, options);
    } catch (error) {
      // 如果格式化失败，返回原始代码
      // console.warn(`Prettier formatting failed for language ${language}:`, error);
      return code;
    }
  }

  /**
   * 根据语言映射到 Prettier 解析器
   */
  private getPrettierParser(language: string): string | null {
    const parserMap: Record<string, string> = {
      javascript: 'babel',
      typescript: 'typescript',
      html: 'html',
      css: 'css',
      scss: 'css',
      json: 'json',
      jsx: 'babel',
      tsx: 'typescript'
    };

    return parserMap[language] || null;
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
