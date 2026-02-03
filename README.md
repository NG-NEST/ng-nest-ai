# NgNest AI

English | [简体中文](README_zh-CN.md)

NgNest AI is a powerful desktop AI chat application built with Angular and Electron. It provides comprehensive project management, conversation history, multi-modal AI interactions, and advanced file system integration capabilities.

<img style="border: 1px solid #fefefe" src="https://github.com/NG-NEST/ng-nest-ai/blob/main/src/assets/images/111222.png" />

## 📖 Table of Contents

- [Key Features](#-key-features)
  - [AI Conversation System](#-ai-conversation-system)
  - [Project Management](#-project-management)
  - [Advanced Features](#️-advanced-features)
  - [Developer Tools](#-developer-tools)
- [Architecture](#️-architecture)
  - [Frontend Stack](#frontend-stack)
  - [Backend Services](#backend-services)
  - [Data Layer](#data-layer)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
  - [Production Build](#production-build)
- [Configuration](#️-configuration)
  - [Environment Variables](#environment-variables)
  - [AI Model Configuration](#ai-model-configuration)
- [Core Modules](#-core-modules)
  - [Project Management System](#project-management-system)
  - [Conversation Engine](#conversation-engine)
  - [Skills System](#skills-system)
  - [File System Integration](#file-system-integration)
- [Internationalization](#-internationalization)
- [API Integration](#-api-integration)
  - [OpenAI Integration](#openai-integration)
  - [MinIO Integration](#minio-integration)
  - [File System API](#file-system-api)
- [Security Features](#️-security-features)
- [Build Configuration](#-build-configuration)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

## ✨ Key Features

### 🤖 AI Conversation System
- **Real-time AI Chat**: Stream-based conversations with multiple AI models
- **Multi-modal Support**: Text, image, and video input capabilities
- **Function Calling**: Built-in skills system with extensible functions
- **Custom Prompts**: System prompt configuration and management
- **Conversation History**: Persistent chat history with search capabilities

### 📁 Project Management
- **Workspace Integration**: Connect projects to local directories
- **File System Monitoring**: Real-time file change detection and synchronization
- **Project-based Sessions**: Organize conversations within project contexts
- **File Tree Navigation**: Built-in file explorer with create/delete/rename operations

### 🛠️ Advanced Features
- **Built-in Skills System**: Extensible function calling with JavaScript, HTTP, and built-in handlers
- **IndexedDB Integration**: Query and manage local database directly from AI conversations
- **MinIO Object Storage**: Seamless file upload and management
- **Multi-language Support**: 8 languages including English, Chinese, Japanese, Korean, German, French, Russian
- **Theme Customization**: Dark/light mode with customizable UI themes

### 🔧 Developer Tools
- **Electron DevTools**: Built-in developer tools integration
- **File System API**: Comprehensive file operations (create, delete, rename, copy)
- **IPC Services**: Modular inter-process communication architecture
- **Hot Reload**: Development server with live reload capabilities

## 🏗️ Architecture

### Frontend Stack
- **Angular 21**: Latest Angular framework with signals and zoneless change detection
- **@ng-nest/ui**: Comprehensive UI component library
- **RxJS**: Reactive programming for state management
- **Monaco Editor**: Code editing capabilities
- **Micromark**: Markdown parsing and rendering

### Backend Services
- **Electron 39**: Cross-platform desktop application framework
- **Node.js**: Server-side runtime
- **Chokidar**: File system watching
- **OpenAI SDK**: AI model integration
- **MinIO Client**: Object storage operations

### Data Layer
- **IndexedDB**: Local database with Dexie.js ORM
- **File System**: Direct file system access and monitoring
- **MinIO**: Cloud object storage for media files

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/ng-nest/ng-nest-ai.git
cd ng-nest-ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and configuration
```

### Development

```bash
# Start development server (Angular + Electron)
npm run start

# Start only Angular development server
npm run start:ng

# Compile Electron TypeScript
npm run build:electron-ts
```

### Production Build

```bash
# Build for production
npm run build:all

# Create executable
npm run build:electron

# Run production build
npm run start:prod
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# MinIO Configuration (for file uploads)
MINIO_ENDPOINT=your_minio_endpoint
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
```

### AI Model Configuration

The application supports multiple AI providers:
- OpenAI (GPT-3.5, GPT-4, GPT-4 Vision)
- Custom API endpoints
- Local model servers

Configure models through the Settings panel in the application.

## 🎯 Core Modules

### Project Management System
- Create and organize multiple projects
- Link projects to local workspace directories
- Real-time file system synchronization
- Project-specific conversation contexts

### Conversation Engine
- Stream-based AI responses
- Function calling with built-in skills
- Multi-modal input support (text, images, videos)
- Conversation branching and history management

### Skills System
The application includes an extensible skills system that allows AI to:
- Query IndexedDB databases
- Perform file system operations
- Execute custom JavaScript code
- Make HTTP requests
- Access system information

### File System Integration
- Real-time file monitoring with Chokidar
- File tree visualization and navigation
- Direct file operations (create, delete, rename, copy)
- Workspace-based project organization

## 🌍 Internationalization

Supported languages:
- English (en_US)
- Chinese Simplified (zh_CN)
- Chinese Traditional (zh_TW)
- Japanese (ja_JP)
- Korean (ko_KR)
- German (de_DE)
- French (fr_FR)
- Russian (ru_RU)

## 🔌 API Integration

### OpenAI Integration
- Stream-based chat completions
- Function calling support
- Multi-modal capabilities
- Custom model configurations

### MinIO Integration
- File upload and storage
- Automatic file URL generation
- Support for images and videos

### File System API
- Cross-platform file operations
- Real-time change monitoring
- Directory scanning and indexing

## 🛡️ Security Features

- Sandboxed JavaScript execution for custom skills
- Secure IPC communication between processes
- Environment variable protection
- File system access controls

## 📦 Build Configuration

The application uses Electron Builder for packaging:

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

Supports Windows, macOS, and Linux distributions.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Angular](https://angular.dev/) - The web framework used
- [Electron](https://www.electronjs.org/) - Desktop application framework
- [ng-nest](https://ngnest.com/) - UI component library
- [OpenAI](https://openai.com/) - AI model provider
