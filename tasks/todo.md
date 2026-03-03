# ng-nest-ai 优化任务清单

> 创建时间: 2026-03-03
> 预估总工时: 20h

---

## 🔴 P0 - 安全与稳定性 (紧急)

### [ ] Task 1: 环境变量验证机制
**预估**: 2h | **文件**: `electron/config/env.config.ts` (新建)

- [ ] 创建 `electron/config/env.config.ts`
- [ ] 定义 `EnvConfig` 接口
- [ ] 实现 `validateEnv()` 函数
- [ ] 修改 `minio.service.ts` 使用验证后的配置
- [ ] 修改 `main.ts` 启动时调用验证

**验收**: 环境变量缺失时应用启动不崩溃，日志输出警告

---

### [ ] Task 2: vm 沙箱安全加固
**预估**: 4h | **文件**: `electron/skills/vm-executor.ts`

- [ ] 定义危险代码模式黑名单 `DANGEROUS_PATTERNS`
- [ ] 实现 `validateCode()` 函数
- [ ] 定义网络请求白名单 `ALLOWED_DOMAINS`
- [ ] 实现 `validateUrl()` 函数
- [ ] 执行前添加代码验证调用
- [ ] 添加内存限制参数 `maxMemoryMB`
- [ ] 优化超时处理逻辑

**验收**: 
- 恶意代码 (`eval`, `require`, `process.env` 等) 被拦截
- 正常技能仍可执行
- 非白名单域名请求被拒绝

---

### [ ] Task 3: API Key 统一加密存储
**预估**: 2h | **文件**: `electron/ipc/services/openai.service.ts`

- [ ] 注入 `SafeStorageService` 依赖
- [ ] 修改 `initialize()` 方法使用加密存储
- [ ] 实现 `storeEncryptedKey()` 私有方法
- [ ] 修改 `getOrCreateOpenAIInstance()` 解密 Key
- [ ] 清理内存中的明文 Key 缓存

**验收**: 
- API Key 在内存中不以明文形式存在
- 应用重启后可正常恢复 API 连接

---

## 🟡 P1 - 测试框架搭建

### [ ] Task 4: 添加单元测试框架
**预估**: 4h | **文件**: 多个

- [ ] 安装 Vitest: `npm install -D vitest @vitest/coverage-v8`
- [ ] 创建 `vitest.config.ts`
- [ ] 创建 `electron/skills/vm-executor.spec.ts`
  - [ ] 测试: 正常代码执行
  - [ ] 测试: 危险模式拦截
  - [ ] 测试: 超时处理
  - [ ] 测试: URL 白名单验证
- [ ] 创建 `electron/config/env.config.spec.ts`
  - [ ] 测试: 环境变量缺失处理
  - [ ] 测试: 配置结构验证
- [ ] 创建 `electron/skills/builtin/file-operations.skill.spec.ts`
  - [ ] 测试: 工作区边界检查
  - [ ] 测试: 软链接攻击防护
- [ ] 更新 `package.json` 测试脚本

**验收**: `npm run test` 执行成功，覆盖率 > 60%

---

## 🟡 P2 - 代码质量提升

### [ ] Task 5: 启用 Angular 模板严格类型检查
**预估**: 1h | **文件**: `tsconfig.json`

- [ ] 修改 `strictTemplates: true`
- [ ] 移除 `fullTemplateTypeCheck` (已被 strictTemplates 替代)
- [ ] 运行 `ng build` 检查错误
- [ ] 修复模板类型错误

**验收**: 构建 success，无模板类型错误

---

### [ ] Task 6: 扩展 Window 类型声明
**预估**: 1h | **文件**: 多个

- [ ] 搜索所有 `(window as any)` 使用
- [ ] 确认 `src/types/global.d.ts` 类型完整
- [ ] 替换为 `window.electronAPI` 类型安全调用
- [ ] 添加缺失的接口定义

**验收**: 无 `(window as any)` 使用，TypeScript 编译无 any 警告

---

### [ ] Task 7: 统一 HTTP 调用工具
**预估**: 2h | **文件**: `electron/utils/http-client.ts` (新建)

- [ ] 创建 `electron/utils/http-client.ts`
- [ ] 实现 `HttpClient` 类，封装 `net.request`
- [ ] 删除 `vm-executor.ts` 中的 `simpleFetch`
- [ ] 删除 `openai.service.ts` 中的 `electronFetch`
- [ ] 三处统一使用 `HttpClient`
- [ ] `http.service.ts` 使用 `HttpClient` 重构

**验收**: HTTP 调用功能正常，代码无重复

---

### [ ] Task 8: 清理热重载 Watcher 资源
**预估**: 1h | **文件**: `electron/ipc/services/openai.service.ts`

- [ ] 添加 `skillWatcher: chokidar.FSWatcher | null` 属性
- [ ] 保存 watcher 引用
- [ ] 实现 `destroy()` 方法关闭 watcher
- [ ] 在 `main.ts` 应用退出时调用 destroy

**验收**: 多次启停应用，无文件句柄泄漏

---

### [ ] Task 9: OpenAI 流式响应背压控制
**预估**: 1h | **文件**: `electron/ipc/services/openai.service.ts`

- [ ] 定义批量大小常量 `BATCH_SIZE = 10`
- [ ] 修改流式响应处理为批量发送
- [ ] 渲染进程适配批量接收逻辑
- [ ] 更新 `global.d.ts` IPC 类型定义

**验收**: 高频流式响应时 CPU/内存使用平稳

---

## 🟢 P3 - 代码整理

### [ ] Task 10: 修正拼写错误
**预估**: 30min | **文件**: 多个

- [ ] 重命名 `src/app/pages/coversation/` → `conversation/`
- [ ] 重命名 `src/app/app.initialezer.ts` → `app.initializer.ts`
- [ ] 更新所有相关导入
- [ ] 更新 `app-routes.ts` 路径引用

**验收**: 全局搜索无拼写错误

---

### [ ] Task 11: 清理未使用的 IPC 抽象层
**预估**: 15min | **文件**: `electron/ipc/main/ipc-channel-registry.ts`

- [ ] 确认 `IpcChannelRegistry` 类未被使用
- [ ] 删除文件 或 整合到现有服务

**验收**: 无死代码

---

### [ ] Task 12: 清理空路由文件
**预估**: 10min | **文件**: `src/app/app.routes.ts`

- [ ] 确认文件为空
- [ ] 删除 `src/app/app.routes.ts`
- [ ] 检查是否有其他文件引用

**验收**: 构建 success，无冗余文件

---

### [ ] Task 13: 添加 API 文档
**预估**: 30min | **文件**: `docs/API.md` (新建)

- [ ] 创建 `docs/` 目录
- [ ] 编写 IPC 通道列表及参数
- [ ] 编写 Skills 系统 API 说明
- [ ] 编写环境变量配置说明

**验收**: 文档完整，新人可阅读理解

---

## 📊 进度跟踪

| 优先级 | 任务数 | 已完成 | 进度 |
|--------|--------|--------|------|
| P0     | 3      | 0      | 0%   |
| P1     | 1      | 0      | 0%   |
| P2     | 5      | 0      | 0%   |
| P3     | 4      | 0      | 0%   |
| **总计** | **13** | **0** | **0%** |

---

## 🔗 相关决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 测试框架 | **待定** | Vitest 更快 / Karma 已有依赖 |
| HTTP 统一 | **待定** | 封装 net 模块 / Node fetch |

---

## 📝 Review

> 完成后填写