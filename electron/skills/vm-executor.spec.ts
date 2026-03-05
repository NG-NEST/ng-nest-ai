import { describe, it, expect } from 'vitest';
import { executeSandboxedJavaScript, validateCode, validateUrl } from './vm-executor';

describe('VM Executor Tests', () => {
  describe('Code Validation', () => {
    it('should validate safe code', () => {
      const result = validateCode('console.log("hello world");');
      expect(result.valid).toBe(true);
    });

    it('should reject dangerous code with eval', () => {
      const result = validateCode('eval("some code");');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('eval');
    });

    it('should reject dangerous code with require', () => {
      const result = validateCode('const fs = require("fs");');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('require');
    });
  });

  describe('URL Validation', () => {
    it('should validate allowed domains', () => {
      const result = validateUrl('https://api.openai.com/v1/chat/completions');
      expect(result.valid).toBe(true);
    });

    it('should reject disallowed domains', () => {
      const result = validateUrl('https://malicious-site.com/api');
      expect(result.valid).toBe(false);
    });
  });

  describe('Code Execution', () => {
    it('should execute simple arithmetic', async () => {
      const result = await executeSandboxedJavaScript('(args) => args.a + args.b', { a: 5, b: 3 });
      expect(result).toBe(8);
    });

    it('should execute string operations', async () => {
      const result = await executeSandboxedJavaScript('(args) => args.str.toUpperCase()', { str: 'hello' });
      expect(result).toBe('HELLO');
    });

    it('should reject dangerous code', async () => {
      await expect(async () => {
        await executeSandboxedJavaScript('eval("dangerous code")', {});
      }).rejects.toThrow();
    });
  });
});