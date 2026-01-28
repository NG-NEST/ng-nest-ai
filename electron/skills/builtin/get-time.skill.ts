// electron/skills/builtin/get-time.skill.ts
import { SkillDefinition } from './types';

export const skill: SkillDefinition = {
  name: 'get_time',
  description: '获取当前服务器时间',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  execute: async () => {
    return {
      time: new Date().toISOString(),
      timestamp: Date.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: new Date().toLocaleString()
    };
  }
};