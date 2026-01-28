// electron/skills/builtin/types.ts

export interface SkillDefinition {
  name: string;
  description: string;
  parameters: any;
  execute: (args: any, context?: SkillContext) => Promise<any>;
}

export interface SkillContext {
  mainWindow?: Electron.BrowserWindow;
  ipcMain?: Electron.IpcMain;
}

export interface SkillModule {
  skill: SkillDefinition;
}