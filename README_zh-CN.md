# NgNest AI

[English](README.md) | 简体中文

NgNest AI 是一个基于 Angular 和 Electron 构建的强大桌面端 AI 聊天应用。它提供了全面的项目管理、对话历史、多模态 AI 交互和高级文件系统集成功能。

<img style="border: 1px solid #fefefe" src="https://github.com/NG-NEST/ng-nest-ai/blob/main/src/assets/images/111222.png" />

## 📖 目录

- [核心特性](#-核心特性)
  - [AI 对话系统](#-ai-对话系统)
  - [项目管理](#-项目管理)
  - [高级功能](#️-高级功能)
  - [开发者工具](#-开发者工具)
- [目录结构](#-目录结构)
- [技术架构](#️-技术架构)
  - [前端技术栈](#前端技术栈)
  - [后端服务](#后端服务)
  - [数据层](#数据层)
- [快速开始](#-快速开始)
  - [环境要求](#环境要求)
  - [安装步骤](#安装步骤)
  - [开发模式](#开发模式)
  - [生产构建](#生产构建)
- [配置说明](#️-配置说明)
  - [环境变量](#环境变量)
  - [AI 模型配置](#ai-模型配置)
- [核心模块](#-核心模块)
  - [项目管理系统](#项目管理系统)
  - [对话引擎](#对话引擎)
  - [技能系统](#技能系统)
  - [文件系统集成](#文件系统集成)
- [国际化支持](#-国际化支持)
- [API 集成](#-api-集成)
  - [OpenAI 集成](#openai-集成)
  - [MinIO 集成](#minio-集成)
  - [文件系统 API](#文件系统-api)
- [安全特性](#️-安全特性)
- [构建配置](#-构建配置)
- [贡献指南](#-贡献指南)
- [许可证](#-许可证)
- [致谢](#-致谢)

## ✨ 核心特性

### 🤖 AI 对话系统
- **实时 AI 聊天**: 基于流式传输的多模型对话
- **多模态支持**: 支持文本、图像和视频输入
- **函数调用**: 内置技能系统，支持可扩展函数
- **自定义提示词**: 系统提示词配置和管理
- **对话历史**: 持久化聊天记录，支持搜索功能

### 📁 项目管理
- **工作区集成**: 将项目连接到本地目录
- **文件系统监控**: 实时文件变更检测和同步
- **基于项目的会话**: 在项目上下文中组织对话
- **文件树导航**: 内置文件浏览器，支持创建/删除/重命名操作

### 🛠️ 高级功能
- **内置技能系统**: 支持 JavaScript、HTTP 和内置处理器的可扩展函数调用
- **IndexedDB 集成**: 直接从 AI 对话中查询和管理本地数据库
- **MinIO 对象存储**: 无缝文件上传和管理
- **多语言支持**: 支持 8 种语言，包括中文、英文、日文、韩文、德文、法文、俄文
- **主题定制**: 深色/浅色模式，支持自定义 UI 主题

### 🔧 开发者工具
- **Electron 开发工具**: 内置开发者工具集成
- **文件系统 API**: 全面的文件操作功能（创建、删除、重命名、复制）
- **IPC 服务**: 模块化进程间通信架构
- **热重载**: 支持实时重载的开发服务器

## 📂 目录结构

```
.
├── electron/              # 主进程 (后端)
│   ├── ipc/               # IPC 定义
│   ├── services/          # 核心服务 (OpenAI, 文件系统)
│   └── skills/            # 技能系统 & 内置技能
├── src/
│   └── app/               # 渲染进程 (前端)
│       ├── components/    # UI 组件 (气泡, 编辑器)
│       ├── core/          # 核心服务 (IndexedDB)
│       └── pages/         # 应用页面
├── build/                 # 构建资源 (图标)
└── scripts/               # 构建 & 启动脚本
```

## 🏗️ 技术架构

### 前端技术栈
- **Angular 21**: 最新的 Angular 框架，支持信号和无区域变更检测
- **@ng-nest/ui**: 全面的 UI 组件库
- **RxJS**: 响应式编程状态管理
- **Monaco Editor**: 代码编辑功能
- **Micromark**: Markdown 解析和渲染

### 后端服务
- **Electron 39**: 跨平台桌面应用框架
- **Node.js**: 服务端运行时
- **Chokidar**: 文件系统监控
- **OpenAI SDK**: AI 模型集成
- **MinIO Client**: 对象存储操作

### 数据层
- **IndexedDB**: 本地数据库，使用 Dexie.js ORM
- **文件系统**: 直接文件系统访问和监控
- **MinIO**: 媒体文件云对象存储

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/ng-nest/ng-nest-ai.git
cd ng-nest-ai

# 安装依赖
npm install

# 设置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 API 密钥和配置
```

### 开发模式

```bash
# 启动开发服务器（Angular + Electron）
npm run start

# 仅启动 Angular 开发服务器
npm run start:ng

# 编译 Electron TypeScript
npm run build:electron-ts
```

### 生产构建

```bash
# 构建生产版本
npm run build:all

# 创建可执行文件
npm run build:electron

# 运行生产构建
npm run start:prod
```

## ⚙️ 配置说明

### 环境变量

在根目录创建 `.env` 文件：

```env
# MinIO 配置（用于文件上传）
MINIO_ENDPOINT=你的_minio_端点
MINIO_ACCESS_KEY=你的_访问密钥
MINIO_SECRET_KEY=你的_秘密密钥
```

### AI 模型配置

应用支持多个 AI 提供商：
- OpenAI（GPT-3.5、GPT-4、GPT-4 Vision）
- 自定义 API 端点
- 本地模型服务器

通过应用内的设置面板配置模型。

## 🎯 核心模块

### 项目管理系统
- 创建和组织多个项目
- 将项目链接到本地工作区目录
- 实时文件系统同步
- 项目特定的对话上下文

### 对话引擎
- 基于流的 AI 响应
- 内置技能的函数调用
- 多模态输入支持（文本、图像、视频）
- 对话分支和历史管理

### 技能系统
应用包含可扩展的技能系统，允许 AI：
- 查询 IndexedDB 数据库
- 执行文件系统操作
- 执行自定义 JavaScript 代码
- 发起 HTTP 请求
- 访问系统信息

#### 添加新技能
要添加新的内置技能，只需在 `electron/skills/builtin/` 目录下创建一个新的 `.skill.ts` 文件。详见 [技能文档](electron/skills/README.md)。


### 文件系统集成
- 使用 Chokidar 进行实时文件监控
- 文件树可视化和导航
- 直接文件操作（创建、删除、重命名、复制）
- 基于工作区的项目组织

## 🌍 国际化支持

支持的语言：
- 英语 (en_US)
- 简体中文 (zh_CN)
- 繁体中文 (zh_TW)
- 日语 (ja_JP)
- 韩语 (ko_KR)
- 德语 (de_DE)
- 法语 (fr_FR)
- 俄语 (ru_RU)

## 🔌 API 集成

### OpenAI 集成
- 基于流的聊天完成
- 函数调用支持
- 多模态功能
- 自定义模型配置

### MinIO 集成
- 文件上传和存储
- 自动文件 URL 生成
- 支持图像和视频

### 文件系统 API
- 跨平台文件操作
- 实时变更监控
- 目录扫描和索引

## 🛡️ 安全特性

- 自定义技能的沙箱 JavaScript 执行
- 进程间安全 IPC 通信
- 环境变量保护
- 文件系统访问控制

## 📦 构建配置

应用使用 Electron Builder 进行打包：

```json
{
  "appId": "com.ngnest.ai",
  "productName": "NgNestAI",
  "directories": {
    "output": "release",
    "buildResources": "build"
  }
}
```

支持 Windows、macOS 和 Linux 发行版。

## 🤝 贡献指南

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

## 📄 许可证

本项目基于 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Angular](https://angular.dev/) - 使用的 Web 框架
- [Electron](https://www.electronjs.org/) - 桌面应用框架
- [ng-nest](https://ngnest.com/) - UI 组件库
- [OpenAI](https://openai.com/) - 使用 openai 
