// electron/skills/builtin/types.ts

export interface SkillDefinition {
  name: string;
  displayName?: string;
  description: string;
  parameters: any;
  execute: (args: any, context?: SkillContext) => Promise<any>;
}

export interface SkillContext {
  mainWindow?: Electron.BrowserWindow;
  ipcMain?: Electron.IpcMain;
  workspace?: string;
}

export interface SkillModule {
  skill: SkillDefinition;
}
