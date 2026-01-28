// electron/skills/builtin/system-info.skill.ts
import { SkillDefinition } from './types';
import { platform, arch, release, totalmem, freemem, cpus } from 'os';

export const skill: SkillDefinition = {
  name: 'get_system_info',
  description: '获取系统信息，包括操作系统、架构、内存使用情况和CPU信息',
  parameters: {
    type: 'object',
    properties: {
      detailed: {
        type: 'boolean',
        description: '是否返回详细信息，包括CPU详情',
        default: false
      }
    },
    required: []
  },
  execute: async (args) => {
    const totalMemory = totalmem();
    const freeMemory = freemem();
    const usedMemory = totalMemory - freeMemory;
    
    const basicInfo = {
      platform: platform(),
      architecture: arch(),
      release: release(),
      memory: {
        total: `${Math.round(totalMemory / 1024 / 1024 / 1024 * 100) / 100} GB`,
        used: `${Math.round(usedMemory / 1024 / 1024 / 1024 * 100) / 100} GB`,
        free: `${Math.round(freeMemory / 1024 / 1024 / 1024 * 100) / 100} GB`,
        usage: `${Math.round(usedMemory / totalMemory * 100)}%`
      },
      timestamp: new Date().toISOString()
    };

    if (args.detailed) {
      const cpuInfo = cpus();
      return {
        ...basicInfo,
        cpu: {
          model: cpuInfo[0]?.model || 'Unknown',
          cores: cpuInfo.length,
          speed: `${cpuInfo[0]?.speed || 0} MHz`,
          details: cpuInfo.map(cpu => ({
            model: cpu.model,
            speed: `${cpu.speed} MHz`
          }))
        }
      };
    }

    return basicInfo;
  }
};