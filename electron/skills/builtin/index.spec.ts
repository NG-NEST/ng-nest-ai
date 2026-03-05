import { describe, it, expect } from 'vitest';
import { loadBuiltinSkills } from './index';

describe('Builtin Skills Tests', () => {
  it('should load builtin skills', async () => {
    const skills = await loadBuiltinSkills();
    expect(Array.isArray(skills)).toBe(true);
    expect(skills.length).toBeGreaterThan(0);
    
    // 检查每个技能都有必要属性
    for (const skill of skills) {
      expect(skill.name).toBeDefined();
      expect(skill.displayName).toBeDefined();
      expect(skill.description).toBeDefined();
      expect(skill.execute).toBeInstanceOf(Function);
    }
  });

  it('should have system info skill', async () => {
    const skills = await loadBuiltinSkills();
    const systemInfoSkill = skills.find(skill => skill.name === 'get_system_info');
    expect(systemInfoSkill).toBeDefined();
    expect(systemInfoSkill?.displayName).toBe('System Information');
  });

  it('should have time skill', async () => {
    const skills = await loadBuiltinSkills();
    const timeSkill = skills.find(skill => skill.name === 'get_time');
    expect(timeSkill).toBeDefined();
    expect(timeSkill?.displayName).toBe('Get Time');
  });

  it('should have file operations skill', async () => {
    const skills = await loadBuiltinSkills();
    const fileOpSkill = skills.find(skill => skill.name === 'file_operations');
    expect(fileOpSkill).toBeDefined();
    expect(fileOpSkill?.displayName).toBe('File Operations');
  });
});