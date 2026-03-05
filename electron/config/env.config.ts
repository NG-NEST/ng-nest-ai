/**
 * 环境变量配置验证
 * 确保必要的配置存在，避免运行时错误
 */

export interface EnvConfig {
  // MinIO 配置
  MINIO_ENDPOINT?: string;
  MINIO_ACCESS_KEY?: string;
  MINIO_SECRET_KEY?: string;
  
  // OpenAI 配置（可选，可从数据库配置）
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  
  // 应用配置
  NODE_ENV?: 'development' | 'production';
}

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * 验证环境变量配置
 * @param requiredVars 需要验证的变量名列表
 * @returns 验证结果
 */
export function validateEnv(requiredVars: string[] = []): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // 检查必需的环境变量
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  // MinIO 配置完整性检查
  const minioVars = ['MINIO_ENDPOINT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY'];
  const minioConfigured = minioVars.some(v => process.env[v]);
  if (minioConfigured) {
    const missingMinio = minioVars.filter(v => !process.env[v]);
    if (missingMinio.length > 0) {
      warnings.push(`MinIO 配置不完整，缺少: ${missingMinio.join(', ')}`);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * 获取环境变量，支持默认值
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

/**
 * 获取必需的环境变量，缺失时抛出错误
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`必需的环境变量 ${key} 未设置`);
  }
  return value;
}

/**
 * 获取环境配置对象
 */
export function getEnvConfig(): EnvConfig {
  return {
    MINIO_ENDPOINT: process.env['MINIO_ENDPOINT'],
    MINIO_ACCESS_KEY: process.env['MINIO_ACCESS_KEY'],
    MINIO_SECRET_KEY: process.env['MINIO_SECRET_KEY'],
    OPENAI_API_KEY: process.env['OPENAI_API_KEY'],
    OPENAI_BASE_URL: process.env['OPENAI_BASE_URL'],
    NODE_ENV: process.env['NODE_ENV'] as 'development' | 'production'
  };
}

/**
 * 打印环境配置状态（用于调试）
 */
export function logEnvStatus(): void {
  const result = validateEnv();
  
  if (result.warnings.length > 0) {
    console.warn('[Env Config] 警告:');
    result.warnings.forEach(w => console.warn(`  - ${w}`));
  }
  
  // 输出已配置的服务
  const services: string[] = [];
  if (process.env['MINIO_ENDPOINT']) services.push('MinIO');
  if (process.env['OPENAI_API_KEY']) services.push('OpenAI');
  
  if (services.length > 0) {
    console.log(`[Env Config] 已配置的服务: ${services.join(', ')}`);
  } else {
    console.log('[Env Config] 未检测到外部服务配置，可在应用内进行配置');
  }
}