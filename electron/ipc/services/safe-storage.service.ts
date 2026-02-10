import { ipcMain, safeStorage, app } from 'electron';

export class SafeStorageService {
  constructor() {
    this.registerIpcHandlers();
  }

  private registerIpcHandlers() {
    ipcMain.handle('ipc:safeStorage:isEncryptionAvailable', () => {
      return safeStorage.isEncryptionAvailable();
    });

    ipcMain.handle('ipc:safeStorage:encryptString', (_event, plainText: string) => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available on this system');
      }
      try {
        const buffer = safeStorage.encryptString(plainText);
        return buffer.toString('base64');
      } catch (error: any) {
        throw new Error(`Encryption failed: ${error.message}`);
      }
    });

    ipcMain.handle('ipc:safeStorage:decryptString', (_event, encryptedBase64: string) => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available on this system');
      }
      try {
        const buffer = Buffer.from(encryptedBase64, 'base64');
        const decrypted = safeStorage.decryptString(buffer);
        return decrypted;
      } catch (error: any) {
        throw new Error(`Decryption failed: ${error.message}`);
      }
    });
  }

  destroy() {
    ipcMain.removeHandler('ipc:safeStorage:isEncryptionAvailable');
    ipcMain.removeHandler('ipc:safeStorage:encryptString');
    ipcMain.removeHandler('ipc:safeStorage:decryptString');
  }
}
