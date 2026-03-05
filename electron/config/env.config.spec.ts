import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateEnv, getEnvConfig, logEnvStatus, getEnv, getRequiredEnv } from './env.config';

describe('Environment Configuration Tests', () => {
  // 保存原始 process.env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 清空环境变量
    process.env = {};
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  describe('validateEnv', () => {
    it('should return valid when no required vars specified', () => {
      const result = validateEnv();
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return missing vars when required vars not set', () => {
      const result = validateEnv(['REQUIRED_VAR1', 'REQUIRED_VAR2']);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['REQUIRED_VAR1', 'REQUIRED_VAR2']);
    });

    it('should return valid when required vars are set', () => {
      process.env.REQUIRED_VAR1 = 'value1';
      process.env.REQUIRED_VAR2 = 'value2';
      const result = validateEnv(['REQUIRED_VAR1', 'REQUIRED_VAR2']);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe('getEnvConfig', () => {
    it('should return empty config when no env vars are set', () => {
      const config = getEnvConfig();
      expect(config).toEqual({
        MINIO_ENDPOINT: undefined,
        MINIO_ACCESS_KEY: undefined,
        MINIO_SECRET_KEY: undefined,
        OPENAI_API_KEY: undefined,
        OPENAI_BASE_URL: undefined,
        NODE_ENV: undefined
      });
    });

    it('should return config with set env vars', () => {
      process.env.MINIO_ENDPOINT = 'http://minio.example.com';
      process.env.OPENAI_API_KEY = 'sk-test123456789';
      process.env.NODE_ENV = 'development';

      const config = getEnvConfig();
      expect(config).toEqual({
        MINIO_ENDPOINT: 'http://minio.example.com',
        MINIO_ACCESS_KEY: undefined,
        MINIO_SECRET_KEY: undefined,
        OPENAI_API_KEY: 'sk-test123456789',
        OPENAI_BASE_URL: undefined,
        NODE_ENV: 'development'
      });
    });
  });

  describe('getEnv and getRequiredEnv', () => {
    it('should return env var value when it exists', () => {
      process.env.TEST_VAR = 'test_value';
      expect(getEnv('TEST_VAR')).toBe('test_value');
    });

    it('should return undefined when env var does not exist', () => {
      expect(getEnv('NON_EXISTENT_VAR')).toBeUndefined();
    });

    it('should return default value when env var does not exist', () => {
      expect(getEnv('NON_EXISTENT_VAR', 'default_value')).toBe('default_value');
    });

    it('should throw error when required env var does not exist', () => {
      expect(() => getRequiredEnv('NON_EXISTENT_VAR')).toThrow('必需的环境变量 NON_EXISTENT_VAR 未设置');
    });

    it('should return value when required env var exists', () => {
      process.env.REQUIRED_VAR = 'required_value';
      expect(getRequiredEnv('REQUIRED_VAR')).toBe('required_value');
    });
  });

  describe('logEnvStatus', () => {
    it('should not throw error when called', () => {
      expect(() => logEnvStatus()).not.toThrow();
    });
  });
});