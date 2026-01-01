import { isMainThread, parentPort, workerData } from 'worker_threads';
import fs from 'fs/promises';
import path from 'path';

interface ScanOptions {
  dirPath: string;
  maxDepth?: number;
  currentDepth?: number;
  maxFiles?: number;
  currentCount?: number;
}

async function scanDirectory(options: ScanOptions): Promise<any[]> {
  const { dirPath, maxDepth = 10, currentDepth = 0, maxFiles, currentCount = 0 } = options;

  if (currentDepth > maxDepth) {
    return [];
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let files: any[] = [];
    let currentFileCount = currentCount;

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        files.push({
          path: fullPath,
          name: entry.name,
          isDir: true
        });

        const subDirFiles = await scanDirectory({
          dirPath: fullPath,
          maxDepth,
          currentDepth: currentDepth + 1,
          maxFiles,
          currentCount
        });

        files = files.concat(subDirFiles);
        currentFileCount += subDirFiles.length;
      } else {
        if (maxFiles && currentFileCount >= maxFiles) {
          break;
        }

        try {
          const stat = await fs.stat(fullPath);
          files.push({
            path: fullPath,
            name: entry.name,
            isDir: false,
            size: stat.size,
            mtime: stat.mtime
          });
        } catch (err) {
          files.push({
            path: fullPath,
            name: entry.name,
            isDir: false
          });
        }

        currentFileCount++;
      }
    }

    return files;
  } catch (error) {
    console.error(`Error in worker scanning directory ${dirPath}:`, error);
    return [];
  }
}

if (!isMainThread && parentPort) {
  const { dirPath, maxFiles } = workerData;

  scanDirectory({ dirPath, maxFiles, maxDepth: 10 })
    .then((result) => {
      parentPort?.postMessage({ success: true, data: result });
    })
    .catch((error) => {
      parentPort?.postMessage({ success: false, error: error.message });
    });
}
