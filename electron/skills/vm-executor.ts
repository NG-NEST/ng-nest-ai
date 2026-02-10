import * as vm from 'vm';
import * as https from 'https';
import * as http from 'http';

// 简单的 fetch 实现
const simpleFetch = (url: string, options: any = {}) => {
  return new Promise((resolve, reject) => {
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch (e) {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }
    
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = protocol.request(requestOptions, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            json: async () => JSON.parse(data),
            text: async () => data
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
};

export async function executeSandboxedJavaScript(code: string, args: any, timeout: number = 30000): Promise<any> {
  try {
    // 创建上下文，提供必要的全局对象
    const context = {
      args,
      console: {
        log: (...args: any[]) => console.log('[Skill]', ...args),
        error: (...args: any[]) => console.error('[Skill]', ...args),
        warn: (...args: any[]) => console.warn('[Skill]', ...args)
      },
      // 提供一些常用的全局函数
      JSON,
      Date,
      Math,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      Promise,
      // 提供 fetch 用于 HTTP 请求
      fetch: simpleFetch
    };

    vm.createContext(context);

    // 包装代码，确保返回结果
    const wrappedCode = `
      (async () => {
        try {
          const userCode = ${JSON.stringify(code)}; 
          // 稍微hack一下：我们不能直接把代码字符串插进去，因为可能包含语法错误
          // 但为了简单，我们假设 code 是函数体或者表达式
          // 更好的方式是像 OpenAIService 那样直接拼接，但要注意 code 本身的内容
          
          // 还原 OpenAIService 的逻辑：
          // code 被视为一个表达式或函数体
          const execute = eval(userCode); // 在沙箱内 eval 是相对安全的，或者直接把 code 作为源码运行
          
          // 实际上 OpenAIService 是这样做的：
          // const execute = ${code}; 
          // 这意味着 code 必须是一个有效的 JS 表达式（如箭头函数或匿名函数）
          // 例如: (args) => { return args.x + 1 }
          
          if (typeof execute === 'function') {
            return await execute(args);
          } else {
            return execute;
          }
        } catch (e) {
          throw e;
        }
      })();
    `;
    
    // 修正：直接使用 OpenAIService 的拼接方式，最简单直接
    const scriptCode = `
      (async () => {
        const execute = ${code};
        if (typeof execute === 'function') {
          return await execute(args);
        } else {
          return execute;
        }
      })();
    `;

    // 执行代码
    const result = await vm.runInContext(scriptCode, context, {
      timeout,
      displayErrors: true
    });

    return result;
  } catch (error) {
    console.error('JavaScript execution error:', error);
    throw error;
  }
}
