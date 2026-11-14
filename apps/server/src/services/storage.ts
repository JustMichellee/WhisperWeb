import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export interface StoredBlobResult {
  relativePath: string;
  sizeBytes: number;
  sha256Checksum: string;
}

export interface IStorageProvider {
  saveBlob(id: string, bytes: Uint8Array): Promise<StoredBlobResult>;
  readBlob(relativePath: string): Promise<Uint8Array>;
  deleteBlob(relativePath: string): Promise<void>;
}

export class LocalDiskStorageProvider implements IStorageProvider {
  constructor(private readonly baseDir: string) {
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  async saveBlob(id: string, bytes: Uint8Array): Promise<StoredBlobResult> {
    const now = new Date();
    const bucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const bucketDir = path.join(this.baseDir, bucket);
    await fsp.mkdir(bucketDir, { recursive: true });

    const safeFileName = `${id.replace(/[^a-zA-Z0-9_-]/g, '')}.enc`;
    const relativePath = path.join(bucket, safeFileName);
    const fullPath = this.resolveSafePath(relativePath);

    const sha256Checksum = crypto.createHash('sha256').update(bytes).digest('hex');
    await fsp.writeFile(fullPath, bytes);

    return {
      relativePath,
      sizeBytes: bytes.byteLength,
      sha256Checksum,
    };
  }

  async readBlob(relativePath: string): Promise<Uint8Array> {
    const fullPath = this.resolveSafePath(relativePath);
    const buffer = await fsp.readFile(fullPath);
    return new Uint8Array(buffer);
  }

  async deleteBlob(relativePath: string): Promise<void> {
    const fullPath = this.resolveSafePath(relativePath);
    await fsp.rm(fullPath, { force: true });
  }

  private resolveSafePath(relativePath: string): string {
    const resolvedBase = path.resolve(this.baseDir);
    const target = path.resolve(resolvedBase, relativePath);
    if (!target.startsWith(resolvedBase + path.sep)) {
      throw new Error('Invalid storage path traversal attempt');
    }
    return target;
  }
}

