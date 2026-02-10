import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SkillDefinition } from '../builtin/types';
import { executeSandboxedJavaScript } from '../vm-executor';

interface SkillMetadata {
  name: string;
  displayName?: string;
  display_name?: string;
  description: string;
  parameters: any;
}

export class MarkdownSkillLoader {
  
  static loadSkill(filePath: string): SkillDefinition | null {
    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      // 处理 BOM 头
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      
      // 1. 解析 Frontmatter
      // 允许第一行以前有空白字符
      const frontmatterMatch = content.match(/^(?:\s*)---\r?\n([\s\S]*?)\r?\n---/);
      if (!frontmatterMatch) {
        console.warn(`Skipping ${filePath}: No frontmatter found`);
        return null;
      }

      const rawMetadata = frontmatterMatch[1];
      const metadata = yaml.load(rawMetadata) as SkillMetadata;
      
      if (!metadata.name || !metadata.description) {
        console.warn(`Skipping ${filePath}: Missing name or description in frontmatter`);
        return null;
      }

      // 2. 提取代码块
      // 匹配 ```javascript 或 ```js 开头的代码块
      const codeBlockMatch = content.match(/```(?:javascript|js)\n([\s\S]*?)\n```/);
      
      let executeFunc: (args: any) => Promise<any>;

      if (codeBlockMatch) {
        const code = codeBlockMatch[1];
        executeFunc = async (args: any) => {
          return await executeSandboxedJavaScript(code, args);
        };
      } else {
        // 如果没有代码块，假设这是一个纯知识型技能（Markdown Knowledge）
        // 这种情况下，execute 应该返回文档内容本身
        const docContent = content.replace(/^---\n[\s\S]*?\n---/, '').trim();
        executeFunc = async () => {
          return {
            type: 'markdown_knowledge',
            content: docContent
          };
        };
      }

      return {
        name: metadata.name,
        displayName: metadata.displayName || metadata.display_name,
        description: metadata.description,
        parameters: metadata.parameters || { type: 'object', properties: {} },
        execute: executeFunc
      };

    } catch (error) {
      console.error(`Failed to load markdown skill from ${filePath}:`, error);
      return null;
    }
  }

  static loadSkillsFromDir(dirPath: string): SkillDefinition[] {
    const skills: SkillDefinition[] = [];
    
    if (!fs.existsSync(dirPath)) {
      return skills;
    }

    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const skill = this.loadSkill(path.join(dirPath, file));
        if (skill) {
          skills.push(skill);
        }
      }
    }
    
    return skills;
  }
}
