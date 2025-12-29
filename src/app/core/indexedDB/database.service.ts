import { Injectable } from '@angular/core';
import { DexieDatabase } from './dexie.db';
import { from } from 'rxjs';
import { Model } from './model.service';

@Injectable({ providedIn: 'root' })
export class AppDataBaseService {
  db!: DexieDatabase;

  init() {
    this.db = new DexieDatabase();

    this.db.on('populate', async () => {
      return this.initDefaultData().toPromise();
    });

    return from(this.db.open());
  }

  initDefaultData() {
    return from(
      (async () => {
        const now = new Date();

        for (let item of this.manufacturers) {
          const id = await this.db.manufacturers.add({
            name: item.name,
            apiKey: item.apiKey,
            baseURL: item.baseURL,
            createdAt: now,
            updatedAt: now,
            isActive: item.isActive
          });
          for (let model of item.models as Model[]) {
            this.db.models.add({
              manufacturerId: id,
              isActive: model.isActive ?? false,
              name: model.name ?? '',
              code: model.code ?? '',
              description: model.description ?? '',
              createdAt: now,
              updatedAt: now,
              usePrompt: model.usePrompt ?? false,
              useUploadImage: model.useUploadImage ?? false,
              useUploadVideo: model.useUploadVideo ?? false,
              inputFunction: model.inputFunction ?? '',
              outputFunction: model.outputFunction ?? '',
              requestType: model.requestType ?? 'OpenAI',
              method: model.method ?? 'POST',
              url: model.url ?? '',
              headersFunction: model.headersFunction ?? '',
              bodyFunction: model.bodyFunction ?? '',
              paramsFunction: model.paramsFunction ?? '',
              tags: model.tags ?? [],
              requests: model.requests ?? []
            });
          }
        }

        for (let item of this.prompts) {
          await this.db.prompts.add({
            name: item.name,
            content: item.content,
            description: item.description,
            createdAt: now,
            updatedAt: now
          });
        }
      })()
    );
  }

  manufacturers = [
    {
      name: 'Google AI',
      apiKey: 'key-xxxxx',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
      isActive: false,
      models: [
        {
          name: 'gemini-1.5-flash',
          code: 'gemini-1.5-flash',
          description: '',
          isActive: true,
          usePrompt: true,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          inputFunction: '',
          outputFunction: '',
          method: 'POST',
          url: null,
          headersFunction: 'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}"\n}',
          bodyFunction: 'return {}',
          paramsFunction: 'return {}',
          tags: null,
          requests: []
        },
        {
          name: 'gemini-2.0-flash-lite',
          code: 'gemini-2.0-flash-lite',
          description: '',
          isActive: false,
          usePrompt: true,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          inputFunction: '',
          outputFunction: '',
          method: 'POST',
          url: null,
          headersFunction: 'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}"\n}',
          bodyFunction: 'return {}',
          paramsFunction: 'return {}',
          tags: null,
          requests: []
        },
        {
          name: 'gemini-2.5-pro',
          code: 'gemini-2.5-pro',
          description: '',
          isActive: false,
          usePrompt: true,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          inputFunction: '',
          outputFunction: '',
          method: 'POST',
          url: null,
          headersFunction: 'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}"\n}',
          bodyFunction: 'return {}',
          paramsFunction: 'return {}',
          tags: null,
          requests: []
        },
        {
          name: 'gemini-2.0-flash',
          code: 'gemini-2.0-flash',
          description: '',
          isActive: false,
          usePrompt: true,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          inputFunction: '',
          outputFunction: '',
          method: 'POST',
          url: null,
          headersFunction: 'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer xxxx"\n}',
          bodyFunction: 'return {}',
          tags: null
        }
      ]
    },
    {
      name: '火山引擎',
      apiKey: 'key-xxxxx',
      baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
      isActive: false,
      models: [
        {
          name: 'Doubao-Seedream-4.5',
          code: 'doubao-seedream-4-5-251128',
          description: '',
          isActive: true,
          usePrompt: false,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'Http',
          inputFunction: '',
          outputFunction:
            "// 提取图片 URL\r\nconst imageUrl = output.data?.[0]?.url;\r\nconst model = output.model;\r\nif (!imageUrl) {\r\n  throw new Error('No image URL found in output.data');\r\n}\r\n\r\n// 生成符合 OpenAI 格式的 ID（模拟）\r\nconst id = `chatcmpl-${crypto.randomUUID().substring(0, 8)}-${Date.now()}`;\r\n\r\nreturn {\r\n  id: id,\r\n  object: 'chat.completion.chunk',\r\n  created: output.created || Math.floor(Date.now() / 1000),\r\n  model: model, // 固定为你指定的模型名\r\n  system_fingerprint: null,\r\n  usage: null, // 注意：目标格式中 usage 为 null\r\n  choices: [\r\n    {\r\n      index: 0,\r\n      delta: {\r\n        role: 'assistant',\r\n        image: imageUrl // 自定义字段\r\n      },\r\n      logprobs: null,\r\n      finish_reason: null\r\n    }\r\n  ]\r\n};",
          method: 'POST',
          url: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
          tags: ['textToImage'],
          headersFunction:
            'return {\r\n  "Content-Type": "application/json",\r\n  "Authorization": "Bearer ${apiKey}"\r\n}',
          bodyFunction:
            'return {\r\n  "model": "${code}",\r\n  "prompt": "${content}",\r\n  "sequential_image_generation": "disabled",\r\n  "response_format": "url",\r\n  "size": "2K",\r\n  "stream": false,\r\n  "watermark": true\r\n}',
          paramsFunction: '',
          requests: []
        },
        {
          name: 'Doubao-Seed-1.6',
          code: 'doubao-seed-1-6-251015',
          description:
            'Doubao-Seed-1.6全新多模态深度思考模型，同时支持minimal/low/medium/high 四种reasoning effort。 更强模型效果，服务复杂任务和有挑战场景。支持 256k 上下文窗口，输出长度支持最大 32k tokens。',
          isActive: false,
          usePrompt: false,
          useUploadImage: true,
          useUploadVideo: false,
          requestType: 'OpenAI',
          inputFunction:
            'return {\r\n  ...input,\r\n  "max_completion_tokens": 65535,\r\n  "reasoning_effort": "medium",\r\n}',
          outputFunction: '',
          method: 'POST',
          url: null,
          tags: ['deepThinking', 'imageToText'],
          headersFunction: '',
          bodyFunction: '',
          paramsFunction: '',
          requests: []
        }
      ]
    },
    {
      name: '讯飞星火',
      apiKey: 'key-xxxxx',
      baseURL: 'https://spark-api-open.xf-yun.com/v2',
      isActive: false,
      models: [
        {
          name: 'Spark-X',
          code: 'spark-x',
          description: '星火深度推理模型',
          isActive: true,
          usePrompt: false,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          inputFunction: '',
          outputFunction: '',
          method: 'POST',
          url: null,
          body: null,
          tags: ['deepThinking'],
          headersFunction:
            'return {\r\n  "Content-Type": "application/json",\r\n  "Authorization": "Bearer ${apiKey}"\r\n}',
          bodyFunction: '',
          paramsFunction: '',
          requests: []
        }
      ]
    },
    {
      name: '百度千帆',
      apiKey: 'key-xxxxx',
      baseURL: 'https://qianfan.baidubce.com/v2',
      isActive: false,
      models: [
        {
          name: '蒸汽机 Air-Image',
          code: 'musesteamer-air-image',
          description:
            'musesteamer-air-image 是百度搜索团队旨在提供极致性价比而研发的文生图模型。能够基于用户输入的提示词快速生成清晰、动作连贯的图片，让用户描述轻松转化为图像。',
          isActive: true,
          usePrompt: false,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'Http',
          inputFunction: '',
          outputFunction:
            "// 提取必要字段\r\nconst imageUrl = output.data?.[0]?.url;\r\nif (!imageUrl) {\r\n  throw new Error('No image URL found in output.data');\r\n}\r\n\r\nreturn {\r\n  id: `chatcmpl-${crypto.randomUUID().substring(0, 8)}-${Date.now()}`, // 模拟 OpenAI ID 格式\r\n  object: 'chat.completion.chunk',\r\n  created: output.created || Math.floor(Date.now() / 1000),\r\n  model: 'musesteamer-air-image',\r\n  system_fingerprint: null,\r\n  usage: null,\r\n  choices: [\r\n    {\r\n      index: 0,\r\n      delta: {\r\n        role: 'assistant',\r\n        image: imageUrl // 自定义字段：非标准 OpenAI，但符合你的需求\r\n      },\r\n      logprobs: null,\r\n      finish_reason: null\r\n    }\r\n  ]\r\n};",
          method: 'POST',
          url: 'https://qianfan.baidubce.com/v2/musesteamer/images/generations',
          body: '{\r\n  "model": "${code}",\r\n  "prompt": "${content}",\r\n  "size": "1024x1024",\r\n  "seed": 42949672,\r\n  "prompt_extend": true,\r\n  "response_format": "url"\r\n}',
          tags: ['textToImage'],
          headersFunction:
            'return {\r\n  "Content-Type": "application/json",\r\n  "Authorization": "Bearer ${apiKey}"\r\n}',
          bodyFunction:
            'return {\r\n  "model": "${code}",\r\n  "prompt": "${content}",\r\n  "size": "1024x1024",\r\n  "seed": 42949672,\r\n  "prompt_extend": true,\r\n  "response_format": "url"\r\n}',
          paramsFunction: '',
          requests: []
        },
        {
          name: 'ernie-4.5-turbo-128k',
          code: 'ernie-4.5-turbo-128k',
          description: '',
          isActive: false,
          usePrompt: true,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          inputFunction:
            'return {\r\n  ...input,\r\n  "web_search": {\r\n    "enable": false,\r\n    "enable_citation": false,\r\n    "enable_trace": false\r\n  },\r\n  "plugin_options": {}\r\n}',
          outputFunction: '',
          method: 'POST',
          url: null,
          headersFunction: 'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}"\n}',
          bodyFunction: '',
          paramsFunction: '',
          tags: null
        }
      ]
    },
    {
      name: 'DeepSeek',
      apiKey: 'key-xxxxx',
      baseURL: 'https://api.deepseek.com',
      isActive: false,
      models: [
        {
          name: 'DeepSeek-V3.2 （思考模式）',
          code: 'deepseek-reasoner',
          description: '',
          isActive: false,
          usePrompt: true,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          inputFunction: '',
          outputFunction: '',
          method: 'POST',
          url: null,
          headersFunction: 'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}"\n}',
          body: null,
          tags: ['deepThinking'],
          bodyFunction: '',
          paramsFunction: '',
          requests: []
        },
        {
          name: 'DeepSeek-V3.2 （非思考模式）',
          code: 'deepseek-chat',
          description: '',
          isActive: false,
          usePrompt: true,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          inputFunction: '',
          outputFunction: '',
          method: 'POST',
          url: null,
          headersFunction: 'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}"\n}',
          bodyFunction: '',
          paramsFunction: '',
          tags: null
        }
      ]
    },
    {
      name: '腾讯混元',
      apiKey: 'key-xxxxx',
      baseURL: 'https://api.hunyuan.cloud.tencent.com/v1',
      isActive: true,
      models: [
        {
          name: 'hunyuan-vision-1.5-instruct',
          code: 'hunyuan-vision-1.5-instruct',
          description: '图生文',
          isActive: false,
          usePrompt: false,
          useUploadImage: true,
          useUploadVideo: false,
          requestType: 'OpenAI',
          inputFunction: '',
          outputFunction: '',
          method: 'POST',
          url: null,
          headersFunction: 'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}"\n}',
          bodyFunction: 'return {}',
          paramsFunction: 'return {}',
          tags: ['imageToText'],
          requests: []
        },
        {
          name: '混元生图（极速版）',
          code: 'TextToImageLite',
          description: '混元文生图接口，基于混元大模型，根据输入的文本描述智能生成图片',
          isActive: false,
          usePrompt: false,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'Http',
          inputFunction: '',
          outputFunction:
            "\r\n// 提取图片 URL\r\nconst imageUrl = output.Response?.ResultImage;\r\nlet id = output.Response?.RequestId;\r\nif (!imageUrl) {\r\n  console.error(output)\r\n  throw new Error('No ResultImage found in output.Response');\r\n}\r\n\r\n// 生成符合 OpenAI 格式的 ID（模拟）\r\nid = `chatcmpl-${id}-${Date.now()}`;\r\n\r\nreturn {\r\n  id: id,\r\n  object: 'chat.completion.chunk',\r\n  created: Math.floor(Date.now() / 1000), // 使用当前时间戳（因原始响应无 created）\r\n  model: 'TextToImageLite', // 固定为你指定的模型名\r\n  system_fingerprint: null,\r\n  usage: null,\r\n  choices: [\r\n    {\r\n      index: 0,\r\n      delta: {\r\n        role: 'assistant',\r\n        image: imageUrl // 来自 ResultImage\r\n      },\r\n      logprobs: null,\r\n      finish_reason: null\r\n    }\r\n  ]\r\n};",
          method: 'POST',
          url: 'https://aiart.tencentcloudapi.com',
          body: '{\r\n  "Prompt": "${content}",\r\n  "RspImgType": "url"\r\n}',
          tags: ['textToImage'],
          headersFunction:
            '\r\nconst crypto = require("crypto")\r\n\r\nconst sha256 = (message, secret = "", encoding) => {\r\n  const hmac = crypto.createHmac("sha256", secret)\r\n  return hmac.update(message).digest(encoding)\r\n}\r\nconst getHash = (message, encoding = "hex") => {\r\n  const hash = crypto.createHash("sha256")\r\n  return hash.update(message).digest(encoding)\r\n}\r\n\r\nconst getDate = (timestamp) => {\r\n  const date = new Date(timestamp * 1000)\r\n  const year = date.getUTCFullYear()\r\n  const month = ("0" + (date.getUTCMonth() + 1)).slice(-2)\r\n  const day = ("0" + date.getUTCDate()).slice(-2)\r\n  return `${year}-${month}-${day}`\r\n}\r\n\r\n// 密钥信息从环境变量读取，需要提前在环境变量中设置 TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY\r\n// 使用环境变量方式可以避免密钥硬编码在代码中，提高安全性\r\n// 生产环境建议使用更安全的密钥管理方案，如密钥管理系统(KMS)、容器密钥注入等\r\n// 请参见：https://cloud.tencent.com/document/product/1278/85305\r\n// 密钥可前往官网控制台 https://console.cloud.tencent.com/cam/capi 进行获取\r\nconst SECRET_ID = "secret_id"\r\nconst SECRET_KEY = "secret_key"\r\n\r\nconst host = "aiart.tencentcloudapi.com"\r\nconst service = "aiart"\r\nconst region = "ap-guangzhou"\r\nconst action = "TextToImageLite"\r\nconst version = "2022-12-29"\r\nconst language = "zh-CN"\r\nconst timestamp = parseInt(String(new Date().getTime() / 1000))\r\nconst date = getDate(timestamp)\r\nconst payload = JSON.stringify({\r\n  "Prompt": "${content}",\r\n  "RspImgType": "url"\r\n});\r\n\r\n// ************* 步骤 1：拼接规范请求串 *************\r\nconst signedHeaders = "content-type;host;x-tc-action;x-tc-language;x-tc-region;x-tc-timestamp;x-tc-version"\r\nconst hashedRequestPayload = getHash(payload)\r\nconst httpRequestMethod = "POST"\r\nconst canonicalUri = "/"\r\nconst canonicalQueryString = ""\r\nconst canonicalHeaders =\r\n  "content-type:application/json; charset=utf-8\\n" +\r\n  "host:" + host + "\\n" +\r\n  "x-tc-action:" + action.toLowerCase() + "\\n" +\r\n  "x-tc-language:" + language.toLowerCase() + "\\n" +\r\n  "x-tc-region:" + region + "\\n" +\r\n  "x-tc-timestamp:" + timestamp + "\\n" +\r\n  "x-tc-version:" + version + "\\n"\r\n\r\nconst canonicalRequest =\r\n  httpRequestMethod + "\\n" +\r\n  canonicalUri + "\\n" +\r\n  canonicalQueryString + "\\n" +\r\n  canonicalHeaders + "\\n" +\r\n  signedHeaders + "\\n" +\r\n  hashedRequestPayload\r\n\r\n// ************* 步骤 2：拼接待签名字符串 *************\r\nconst algorithm = "TC3-HMAC-SHA256"\r\nconst hashedCanonicalRequest = getHash(canonicalRequest)\r\nconst credentialScope = date + "/" + service + "/" + "tc3_request"\r\nconst stringToSign =\r\n  algorithm +\r\n  "\\n" +\r\n  timestamp +\r\n  "\\n" +\r\n  credentialScope +\r\n  "\\n" +\r\n  hashedCanonicalRequest\r\n\r\n// ************* 步骤 3：计算签名 *************\r\nconst kDate = sha256(date, "TC3" + SECRET_KEY)\r\nconst kService = sha256(service, kDate)\r\nconst kSigning = sha256("tc3_request", kService)\r\nconst signature = sha256(stringToSign, kSigning, "hex")\r\n\r\n// ************* 步骤 4：拼接 Authorization *************\r\nconst authorization =\r\n  algorithm +\r\n  " " +\r\n  "Credential=" +\r\n  SECRET_ID +\r\n  "/" +\r\n  credentialScope +\r\n  ", " +\r\n  "SignedHeaders=" +\r\n  signedHeaders +\r\n  ", " +\r\n  "Signature=" +\r\n  signature\r\n\r\n// ************* 步骤 5：构造请求头 *************\r\nconst headers = {\r\n  Authorization: authorization,\r\n  "Content-Type": "application/json; charset=utf-8",\r\n  Host: host,\r\n  "X-TC-Action": action,\r\n  "X-TC-Language": language,\r\n  "X-TC-Timestamp": timestamp,\r\n  "X-TC-Region": region,\r\n  "X-TC-Version": version\r\n}\r\n\r\nreturn headers;\r\n',
          bodyFunction: 'return {\r\n  "Prompt": "${content}",\r\n  "RspImgType": "url"\r\n}',
          paramsFunction: '',
          requests: []
        },
        {
          name: '混元 T1 模型',
          code: 'hunyuan-t1-latest',
          description:
            'TurboS基座，业内首个超大规模 Hybrid-Transformer-Mamba 推理模型，扩展推理能力，超强解码速度，进一步对齐人类偏好。',
          isActive: true,
          inputTranslation: false,
          inputFunction: null,
          outputTranslation: false,
          outputFunction: null,
          usePrompt: true,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          method: 'POST',
          url: null,
          tags: null
        },
        {
          name: '混元 Turbos 模型',
          code: 'hunyuan-turbos-latest',
          description: '此模型为混元旗舰大模型最新版本，具备更强思考能力，更优体验效果',
          isActive: false,
          inputTranslation: false,
          inputFunction: null,
          outputTranslation: false,
          outputFunction: null,
          usePrompt: true,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          method: 'POST',
          url: null,
          tags: null
        }
      ]
    },
    {
      name: '阿里云百炼',
      apiKey: 'key-xxxxx',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      isActive: false,
      models: [
        {
          name: '通义万象图生视频',
          code: 'wan2.6-i2v',
          description: '通义万相-图生视频模型根据首帧图像和文本提示词，生成一段流畅的视频',
          isActive: false,
          usePrompt: false,
          useUploadImage: true,
          useUploadVideo: false,
          requestType: 'Http',
          inputFunction: '',
          outputFunction:
            'const { code, message } = output;\r\nif (code) {\r\n  return {\r\n    error: true,\r\n    message: message,\r\n    detail: ouput\r\n  }\r\n}\r\nreturn output.output;',
          method: 'POST',
          url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
          headersFunction:
            'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}",\n  "X-DashScope-Async": "enable"\n}',
          bodyFunction:
            'return {\r\n  "model": "${code}",\r\n  "input": {\r\n    "prompt": "${content}",\r\n    "img_url": "${image}"\r\n  },\r\n  "parameters": {\r\n    "resolution": "720P",\r\n    "prompt_extend": true,\r\n    "duration": 5,\r\n    "audio": true,\r\n    "shot_type": "multi"\r\n  }\r\n}',
          paramsFunction: 'return {}',
          tags: ['imageToVideo'],
          requests: [
            {
              id: '80709306-f34e-4aaf-b9fc-51ca77acd83e',
              method: 'GET',
              url: 'https://dashscope.aliyuncs.com/api/v1/tasks/${task_id}',
              headersFunction:
                'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}"\n}',
              bodyFunction: 'return {}',
              paramsFunction: 'return {}',
              outputFunction:
                "const { task_status } = output.output ?? {};\r\n// PENDING：任务排队中\r\n// RUNNING：任务处理中\r\n// SUCCEEDED：任务执行成功\r\n// FAILED：任务执行失败\r\n// CANCELED：任务已取消\r\n// UNKNOWN：任务不存在或状态未知\r\nif (['PENDING', 'RUNNING'].includes(task_status)) {\r\n  return { retry: true, interval: 10000, maxRetries: 100 }\r\n} else if (task_status === 'SUCCEEDED') {\r\n  // 构造 OpenAI 兼容的 completion chunk\r\n  return {\r\n    id: output.request_id || `chatcmpl-${Date.now()}`,\r\n    object: 'chat.completion.chunk',\r\n    created: Math.floor(Date.now() / 1000),\r\n    model: '${code}',\r\n    system_fingerprint: null,\r\n    choices: [\r\n      {\r\n        index: 0,\r\n        delta: {\r\n          role: 'assistant',\r\n          video: output.output?.video_url,\r\n          videoActualPrompt: output.output?.actual_prompt,\r\n        },\r\n        logprobs: null,\r\n        finish_reason: 'stop',\r\n      }\r\n    ],\r\n    usage: output.usage ?? null,\r\n  };\r\n} else {\r\n  return {\r\n    error: true,\r\n    message: output.output?.message ?? `Http request error [${task_status}]`,\r\n    detail: output\r\n  }\r\n}"
            }
          ]
        },
        {
          name: '万相 2.5 preview',
          code: 'wan2.5-t2v-preview',
          description: '支持自动配音，或传入自定义音频文件',
          isActive: false,
          usePrompt: false,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'Http',
          inputFunction: '',
          outputFunction:
            'const { code, message } = output;\r\nif (code) {\r\n  return {\r\n    error: true,\r\n    message: message,\r\n    detail: ouput\r\n  }\r\n}\r\nreturn output.output;',
          method: 'POST',
          url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
          headersFunction:
            'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}",\n  "X-DashScope-Async": "enable"\n}',
          bodyFunction:
            'return {\r\n  "model": "${code}",\r\n  "input": {\r\n    "prompt": "${content}"\r\n  },\r\n  "parameters": {\r\n    "size": "832*480",\r\n    "prompt_extend": true,\r\n    "duration": 5,\r\n    "audio": true\r\n  }\r\n}',
          tags: ['textToVideo'],
          paramsFunction: '',
          requests: [
            {
              id: 'a880492f-808c-4343-80b8-d26aad73649e',
              method: 'GET',
              url: 'https://dashscope.aliyuncs.com/api/v1/tasks/${task_id}',
              headersFunction:
                'return {\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}"\n}',
              bodyFunction: 'return {}',
              paramsFunction: 'return {}',
              outputFunction:
                "const { task_status } = output.output ?? {};\r\n// PENDING：任务排队中\r\n// RUNNING：任务处理中\r\n// SUCCEEDED：任务执行成功\r\n// FAILED：任务执行失败\r\n// CANCELED：任务已取消\r\n// UNKNOWN：任务不存在或状态未知\r\nif (['PENDING', 'RUNNING'].includes(task_status)) {\r\n  return { retry: true, interval: 10000, maxRetries: 100 }\r\n} else if (task_status === 'SUCCEEDED') {\r\n  // 构造 OpenAI 兼容的 completion chunk\r\n  return {\r\n    id: output.request_id || `chatcmpl-${Date.now()}`,\r\n    object: 'chat.completion.chunk',\r\n    created: Math.floor(Date.now() / 1000),\r\n    model: '${code}',\r\n    system_fingerprint: null,\r\n    choices: [\r\n      {\r\n        index: 0,\r\n        delta: {\r\n          role: 'assistant',\r\n          video: output.output?.video_url,\r\n          videoActualPrompt: output.output?.actual_prompt,\r\n        },\r\n        logprobs: null,\r\n        finish_reason: 'stop',\r\n      }\r\n    ],\r\n    usage: output.usage ?? null,\r\n  };\r\n} else {\r\n  return {\r\n    error: true,\r\n    message: output.output?.message ?? `Http request error [${task_status}]`,\r\n    detail: output\r\n  }\r\n}"
            }
          ]
        },
        {
          name: '通义千问3-VL-Plus',
          code: 'qwen3-vl-plus',
          description:
            'Qwen3系列视觉理解模型，实现思考模式和非思考模式的有效融合，视觉智能体能力在OS World等公开测试集上达到世界顶尖水平。此版本在视觉coding、空间感知、多模态思考等方向全面升级；视觉感知与识别能力大幅提升，支持超长视频理解。',
          isActive: true,
          usePrompt: false,
          useUploadFile: true,
          requestType: 'OpenAI',
          inputFunction: 'return {\r\n  ...input,\r\n  enable_thinking: true,\r\n  thinking_budget: 81920\r\n}',
          outputFunction: '',
          method: 'POST',
          url: null,
          body: null,
          tags: ['deepThinking', 'imageToText', 'videoToText'],
          useUploadImage: true,
          useUploadVideo: true,
          headersFunction: '',
          bodyFunction: '',
          paramsFunction: '',
          requests: []
        },
        {
          name: '通义千问-Image-Plus',
          code: 'qwen-image-plus',
          description:
            '通义千问系列图像生成模型，参数规模200亿。具备卓越的文本渲染能力，在复杂文本渲染、各类生成与编辑任务重表现出色，在多个公开基准测试中获得SOTA，模型性能大幅提升。',
          isActive: false,
          inputTranslation: false,
          inputFunction: null,
          outputTranslation: false,
          outputFunction:
            "if (output.code) {\r\n  return {\r\n    error: true,\r\n    message: output.message,\r\n    detail: ouput\r\n  }\r\n}\r\n\r\nconst imageUrl = output?.output?.choices?.[0]?.message?.content?.[0]?.image;\r\n\r\nif (!imageUrl) {\r\n  return {\r\n    error: true,\r\n    message: \"Invalid Qwen image response: image URL not found\",\r\n    detail: ouput\r\n  }\r\n}\r\n\r\n// 构造 OpenAI 兼容的 completion chunk\r\nreturn {\r\n  id: output.request_id || `chatcmpl-${Date.now()}`,\r\n  object: 'chat.completion.chunk',\r\n  created: Math.floor(Date.now() / 1000),\r\n  model: 'qwen-image-plus',\r\n  system_fingerprint: null,\r\n  choices: [\r\n    {\r\n      index: 0,\r\n      delta: {\r\n        role: 'assistant',\r\n        image: imageUrl, // 注意：OpenAI 的 content 是字符串，所以直接放 URL\r\n      },\r\n      logprobs: null,\r\n      finish_reason: 'stop', // 因为是完整结果，不是流式中间 chunk\r\n    }\r\n  ],\r\n  usage: output.usage\r\n    ? {\r\n      prompt_tokens: 0,\r\n      completion_tokens: 1,\r\n      total_tokens: 1,\r\n      // 可选：保留原始尺寸信息（非标准字段）\r\n      width: output.usage.width,\r\n      height: output.usage.height,\r\n    }\r\n    : null,\r\n};",
          requestType: 'Http',
          method: 'POST',
          url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
          usePrompt: false,
          useUploadFile: false,
          useUploadImage: false,
          useUploadVideo: false,
          tags: ['textToImage'],
          headersFunction:
            'return {\r\n  "Content-Type": "application/json",\r\n  "Authorization": "Bearer ${apiKey}"\r\n}',
          bodyFunction:
            'return {\r\n  "model": "${code}",\r\n  "input": {\r\n    "messages": [\r\n      {\r\n        "role": "user",\r\n        "content": [\r\n          {\r\n            "text": "${content}"\r\n          }\r\n        ]\r\n      }\r\n    ]\r\n  },\r\n  "parameters": {\r\n    "negative_prompt": "",\r\n    "prompt_extend": true,\r\n    "watermark": false,\r\n    "size": "1328*1328"\r\n  }\r\n}',
          paramsFunction: '',
          requests: []
        },
        {
          name: '通义千问3-235B-A22B-Instruct-2507',
          code: 'qwen3-235b-a22b-instruct-2507',
          description:
            '基于Qwen3的非思考模式开源模型，相较上一版本（通义千问3-235B-A22B）主观创作能力与模型安全性均有小幅度提升。',
          isActive: false,
          inputTranslation: false,
          inputFunction: 'console.log("输入转换成功")\r\nreturn input;',
          outputTranslation: false,
          outputFunction: 'console.log("输出转换成功")\r\nreturn output;',
          usePrompt: true,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          method: 'POST',
          url: null,
          tags: null
        },
        {
          name: 'Qwen3-VL-32B-Thinking',
          code: 'qwen3-vl-32b-thinking',
          description:
            'Qwen3-VL系列最大尺寸Dense模型的推理版本，多模态推理能力仅次于Qwen3-VL-235B-Thinking，STEM&数学类解题能力、通用图像和视频理解能力出众，多模态Agent能力达到SOTA，适合做复杂多模态推理任务。',
          isActive: false,
          usePrompt: true,
          useUploadFile: true,
          requestType: 'OpenAI',
          inputFunction: '',
          outputFunction: '',
          method: 'POST',
          url: null,
          headers: [],
          body: null,
          tags: ['deepThinking'],
          useUploadImage: false,
          useUploadVideo: false,
          headersFunction: '',
          bodyFunction: '',
          paramsFunction: '',
          requests: []
        },
        {
          name: 'Qwen3-VL-32B-Instruct',
          code: 'qwen3-vl-32b-instruct',
          description:
            'Qwen3-VL系列最大尺寸Dense模型的非推理版本，综合表现仅次于Qwen3-VL-235B-Instruct，文档识别和理解能力出色，空间感知与万物识别能力强，视觉2D检测/空间推理能力达到SOTA，适合通用场景下的复杂感知任务。',
          isActive: false,
          usePrompt: true,
          useUploadImage: false,
          useUploadVideo: false,
          requestType: 'OpenAI',
          inputFunction: '',
          outputFunction: '',
          method: 'POST',
          url: null,
          tags: null
        }
      ]
    }
  ];

  prompts = [
    {
      name: '通用',
      content: '#### 规则\r\n- 使用中文回答\r\n- 不要猜测问题\r\n- 直接给出答案\r\n- 使用序号或者 emoji 图标按条理列出',
      description: ''
    },
    {
      name: '小学二年级数学老师123',
      content:
        '#### 角色定义\r\n- 你是一个小学二年级数学老师\r\n#### 规则\r\n- 请使用小学二年级数学所学的知识来回答问题',
      description: ''
    },
    {
      name: '翻译小能手',
      content:
        '#### 角色定义\r\n- 你是一个专业语言翻译\r\n#### 规则\r\n- 根据给出的中文/英文，翻译成对应的英文/中文\r\n- 只输出翻译后的内容，不要加其它的文字',
      description: ''
    },
    {
      name: '物理学家',
      content: '#### 角色定义\r\n- 你是一个专业的物理数学家\r\n#### 规则\r\n- 只能回答✅和❌\r\n- 请基于物理方面的知识',
      description: ''
    },
    {
      name: '数学家',
      content: '#### 角色定义\n- 你是一个专业的数学家\n#### 规则\n- 只能回答✅和❌\n- 请基于数学方面的知识',
      description: ''
    }
  ];
}
