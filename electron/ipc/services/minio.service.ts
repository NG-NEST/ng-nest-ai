import * as Minio from 'minio';
import { getEnvConfig } from '../../config/env.config';

export class MinioService {
  private minioClient: Minio.Client | null = null;

  constructor() {
    const config = getEnvConfig();
    const { MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY } = config;
    if (!MINIO_ENDPOINT || !MINIO_ACCESS_KEY || !MINIO_SECRET_KEY) {
      console.warn('[MinioService] MinIO 配置不完整');
    } else {
      this.minioClient = new Minio.Client({
        endPoint: MINIO_ENDPOINT, useSSL: true, accessKey: MINIO_ACCESS_KEY, secretKey: MINIO_SECRET_KEY
      });
    }
  }

  uploadFile(bucketName: string, objectName: string, fileDataBase64: string, contentType?: string): Promise<boolean> {
    return this._upload(bucketName, objectName, Buffer.from(fileDataBase64, 'base64'), contentType ? { 'Content-Type': contentType } : undefined);
  }

  private async _upload(bucketName: string, objectName: string, fileData: Buffer, metaData?: Minio.ItemBucketMetadata): Promise<boolean> {
    if (!this.minioClient) return false;
    try {
      await this.minioClient.putObject(bucketName, objectName, fileData, Buffer.byteLength(fileData), metaData);
      return true;
    } catch (error) {
      console.error('Upload file error:', error);
      return false;
    }
  }
}
