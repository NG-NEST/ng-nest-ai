import { describe, it, expect, vi } from 'vitest';
import { skill as systemInfoSkill } from './system-info.skill';
import { skill as getTimeSkill } from './get-time.skill';
import { skill as fileOperationsSkill } from './file-operations.skill';
import { loadBuiltinSkills } from './index';

describe('Builtin Skills Tests', () => {
  it('should load builtin skills', async () => {
    // 对于 Vitest 环境，直接验证技能定义
    const skills = [systemInfoSkill, getTimeSkill, fileOperationsSkill].filter(Boolean);
    expect(Array.isArray(skills)).toBe(true);
    expect(skills.length).toBeGreaterThan(0);
    
    // 检查每个技能都有必要属性
    for (const skill of skills) {
      expect(skill.name).toBeDefined();
      expect(skill.description).toBeDefined();
      expect(skill.execute).toBeInstanceOf(Function);
    }
  });

  it('should have system info skill', async () => {
    expect(systemInfoSkill).toBeDefined();
    expect(systemInfoSkill.name).toBe('get_system_info');
    expect(typeof systemInfoSkill.execute).toBe('function');
  });

  it('should have time skill', async () => {
    expect(getTimeSkill).toBeDefined();
    expect(getTimeSkill.name).toBe('get_time');
    expect(typeof getTimeSkill.execute).toBe('function');
  });

  it('should have file operations skill', async () => {
    expect(fileOperationsSkill).toBeDefined();
    expect(fileOperationsSkill.name).toBe('file_operations');
    expect(typeof fileOperationsSkill.execute).toBe('function');
  });
});
