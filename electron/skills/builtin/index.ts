// electron/skills/builtin/index.ts
import { readdirSync } from 'fs';
import { join } from 'path';
import { SkillDefinition, SkillModule } from './types';

/**
 * 动态加载所有内置技能
 * @returns Promise<SkillDefinition[]> 技能定义数组
 */
export async function loadBuiltinSkills(): Promise<SkillDefinition[]> {
  const skills: SkillDefinition[] = [];
  const skillsDir = __dirname;
  
  try {
    // 读取当前目录下的所有 .skill.ts 或 .skill.js 文件
    const files = readdirSync(skillsDir).filter(file => 
      file.endsWith('.skill.ts') || file.endsWith('.skill.js')
    );
    
    for (const file of files) {
      try {
        const skillPath = join(skillsDir, file);
        const skillModule: SkillModule = require(skillPath);
        
        if (skillModule.skill && typeof skillModule.skill === 'object') {
          skills.push(skillModule.skill);
          console.log(`Loaded builtin skill: ${skillModule.skill.name}`);
        } else {
          console.warn(`Invalid skill module in ${file}: missing or invalid 'skill' export`);
        }
      } catch (error) {
        console.error(`Failed to load skill from ${file}:`, error);
      }
    }
    
    console.log(`Loaded ${skills.length} builtin skills`);
    return skills;
  } catch (error) {
    console.error('Failed to load builtin skills:', error);
    return [];
  }
}

/**
 * 获取内置技能名称列表
 * @returns Promise<string[]> 技能名称数组
 */
export async function getBuiltinSkillNames(): Promise<string[]> {
  const skills = await loadBuiltinSkills();
  return skills.map(skill => skill.name);
}

// 导出类型
export * from './types';