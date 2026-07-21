import { safeStorage } from 'electron';

export class SafeStorageService {
  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  encryptString(plainText: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system');
    }
    const buffer = safeStorage.encryptString(plainText);
    return buffer.toString('base64');
  }

  decryptString(encryptedBase64: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system');
    }
    try {
      const buffer = Buffer.from(encryptedBase64, 'base64');
      return safeStorage.decryptString(buffer);
    } catch {
      // Value was stored as plaintext (e.g. saved before encryption was available).
      // Return it as-is so stored keys remain usable.
      return encryptedBase64;
    }
  }
}
