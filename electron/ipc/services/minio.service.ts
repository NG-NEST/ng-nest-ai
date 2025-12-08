import { ipcMain, IpcMainInvokeEvent } from 'electron';
import * as Minio from 'minio';
import { env } from 'node:process';

export interface IMinioService {
  uploadFile(
    bucketName: string,
    objectName: string,
    fileData: Buffer,
    metaData?: Minio.ItemBucketMetadata
  ): Promise<boolean>;
  downloadFile(bucketName: string, objectName: string, filePath: string): Promise<boolean>;
  listBuckets(): Promise<string[]>;
  destroy(): void;
}

export class MinioService implements IMinioService {
  private registeredHandlers = new Map<string, Function>();
  private isDestroyed = false;
  private minioClient: Minio.Client;

  constructor() {
    const { MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY } = env;
    this.minioClient = new Minio.Client({
      endPoint: MINIO_ENDPOINT!,
      useSSL: true,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY
    });
    this.registerIpcHandlers();
  }

  /**
   * 上传文件数据到指定的存储桶
   * @param bucketName 存储桶名称
   * @param objectName 对象名称（文件名）
   * @param fileData 文件数据Buffer
   * @param metaData 文件元数据
   * @returns 上传是否成功
   */
  async uploadFile(
    bucketName: string,
    objectName: string,
    fileData: Buffer,
    metaData?: Minio.ItemBucketMetadata
  ): Promise<boolean> {
    if (this.isDestroyed) return false;

    try {
      const size = Buffer.byteLength(fileData);
      await this.minioClient.putObject(bucketName, objectName, fileData, size, metaData);
      return true;
    } catch (error) {
      console.error('Upload file error:', error);
      return false;
    }
  }

  /**
   * 从存储桶下载文件
   * @param bucketName 存储桶名称
   * @param objectName 对象名称（文件名）
   * @param filePath 保存到本地的文件路径
   * @returns 下载是否成功
   */
  async downloadFile(bucketName: string, objectName: string, filePath: string): Promise<boolean> {
    if (this.isDestroyed) return false;

    try {
      await this.minioClient.fGetObject(bucketName, objectName, filePath);
      return true;
    } catch (error) {
      console.error('Download file error:', error);
      return false;
    }
  }

  /**
   * 获取所有存储桶列表
   * @returns 存储桶名称列表
   */
  async listBuckets(): Promise<string[]> {
    if (this.isDestroyed) return [];

    try {
      const buckets = await this.minioClient.listBuckets();
      return buckets.map((bucket) => bucket.name);
    } catch (error) {
      console.error('List buckets error:', error);
      return [];
    }
  }

  /**
   * 处理前端传递的文件数据并上传
   * @param _event IPC事件对象
   * @param bucketName 存储桶名称
   * @param objectName 对象名称
   * @param fileDataBase64 Base64编码的文件数据
   * @param contentType 文件MIME类型
   * @returns 上传结果
   */
  private async handleFileUpload(
    _event: IpcMainInvokeEvent,
    bucketName: string,
    objectName: string,
    fileDataBase64: string,
    contentType?: string
  ): Promise<boolean> {
    try {
      // 将Base64数据转换为Buffer
      const fileData = Buffer.from(fileDataBase64, 'base64');

      // 准备元数据
      const metaData: Minio.ItemBucketMetadata = {};
      if (contentType) {
        metaData['Content-Type'] = contentType;
      }

      // 执行上传
      return await this.uploadFile(bucketName, objectName, fileData, metaData);
    } catch (error) {
      console.error('Handle file upload error:', error);
      return false;
    }
  }

  /**
   * 注册 IPC 处理程序
   */
  private registerIpcHandlers(): void {
    const handlers = new Map<string, Function>([
      [
        `ipc:minio:uploadFile`,
        (
          event: IpcMainInvokeEvent,
          bucketName: string,
          objectName: string,
          fileDataBase64: string,
          contentType?: string
        ) => this.handleFileUpload(event, bucketName, objectName, fileDataBase64, contentType)
      ],
      [
        `ipc:minio:downloadFile`,
        (_event: IpcMainInvokeEvent, bucketName: string, objectName: string, filePath: string) =>
          this.downloadFile(bucketName, objectName, filePath)
      ],
      [`ipc:minio:listBuckets`, () => this.listBuckets()]
    ]);

    handlers.forEach((handler, eventName) => {
      if (!this.registeredHandlers.has(eventName)) {
        ipcMain.handle(eventName, async (event: IpcMainInvokeEvent, ...args: any[]) => {
          try {
            return await handler(event, ...args);
          } catch (error) {
            throw error;
          }
        });
        this.registeredHandlers.set(eventName, handler);
      }
    });
  }

  /**
   * 销毁服务并清理资源
   */
  destroy(): void {
    if (this.isDestroyed) return;

    this.registeredHandlers.forEach((_, eventName) => {
      ipcMain.removeHandler(eventName);
    });
    this.registeredHandlers.clear();
    this.isDestroyed = true;
  }
}
