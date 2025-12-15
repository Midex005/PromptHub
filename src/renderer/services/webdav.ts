/**
 * WebDAV 同步服务 - 支持增量备份、图片同步、版本历史和双向同步
 * 
 * 增量备份架构：
 * prompthub-backup/
 * ├── manifest.json          # 索引文件，记录所有文件的 hash 和时间戳
 * ├── data.json              # 核心数据（prompts, folders, versions, config）
 * └── images/
 *     ├── {hash1}.base64     # 图片按内容 hash 存储
 *     └── ...
 */

import { getAllPrompts, getAllFolders, restoreFromBackup, exportDatabase } from './database';
import type { PromptVersion } from '../../shared/types';

interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
}

interface SyncResult {
  success: boolean;
  message: string;
  timestamp?: string;
  details?: {
    promptsUploaded?: number;
    promptsDownloaded?: number;
    imagesUploaded?: number;
    imagesDownloaded?: number;
    skipped?: number;  // 跳过的文件数（未变化）
  };
}

// 增量备份 Manifest 结构
interface BackupManifest {
  version: string;           // 备份格式版本
  createdAt: string;         // 首次创建时间
  updatedAt: string;         // 最后更新时间
  dataHash: string;          // data.json 的 hash
  images: {                  // 图片索引
    [fileName: string]: {
      hash: string;          // 内容 hash
      size: number;          // 文件大小
      uploadedAt: string;    // 上传时间
    };
  };
  encrypted?: boolean;       // 是否加密
}

interface BackupData {
  version: string;
  exportedAt: string;
  prompts: any[];
  folders: any[];
  versions?: PromptVersion[];  // 版本历史
  images?: { [fileName: string]: string }; // fileName -> base64（兼容旧版）
  // AI 配置（可选，用于同步）
  aiConfig?: {
    aiModels?: any[];
    aiProvider?: string;
    aiApiKey?: string;
    aiApiUrl?: string;
    aiModel?: string;
  };
  // 系统设置（可选，用于跨设备一致）
  settings?: any;
  settingsUpdatedAt?: string;
  // 加密标记
  encrypted?: boolean;
}

// WebDAV 同步选项
export interface WebDAVSyncOptions {
  includeImages?: boolean;      // 是否包含图片（全量备份）
  encryptionPassword?: string;  // 加密密码（实验性）
  incrementalSync?: boolean;    // 是否使用增量同步（默认 true）
}

// WebDAV 文件路径
const BACKUP_DIR = 'prompthub-backup';
const MANIFEST_FILENAME = 'manifest.json';
const DATA_FILENAME = 'data.json';
const IMAGES_DIR = 'images';
// 兼容旧版单文件备份
const LEGACY_BACKUP_FILENAME = 'prompthub-backup.json';
// 临时兼容：保持旧的常量名
const BACKUP_FILENAME = LEGACY_BACKUP_FILENAME;

/**
 * Uint8Array 转 Base64（避免栈溢出）
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Base64 转 Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 简单的 AES-GCM 加密（实验性功能）
 * 警告：忘记密码将无法恢复数据！
 * 注意：只加密 JSON 数据，不加密图片
 */
async function encryptData(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // 从密码派生密钥
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );
  
  // 组合 salt + iv + 加密数据，转为 base64
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  return uint8ArrayToBase64(combined);
}

/**
 * 解密数据
 */
async function decryptData(encryptedBase64: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // 解码 base64
  const combined = base64ToUint8Array(encryptedBase64);
  
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);
  
  // 从密码派生密钥
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  return decoder.decode(decrypted);
}

/**
 * 计算字符串的简单 hash（用于增量同步）
 */
async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * 上传单个文件到 WebDAV
 */
async function uploadFile(url: string, config: WebDAVConfig, content: string): Promise<boolean> {
  try {
    if (window.electron?.webdav?.upload) {
      const result = await window.electron.webdav.upload(url, config, content);
      return result.success;
    }
    
    const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'PromptHub/1.0',
      },
      body: content,
    });
    return response.ok || response.status === 201 || response.status === 204;
  } catch (error) {
    console.error('Upload file failed:', error);
    return false;
  }
}

/**
 * 下载单个文件从 WebDAV
 */
async function downloadFile(url: string, config: WebDAVConfig): Promise<{ success: boolean; data?: string; notFound?: boolean }> {
  try {
    if (window.electron?.webdav?.download) {
      return await window.electron.webdav.download(url, config);
    }
    
    const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'PromptHub/1.0',
      },
    });
    
    if (response.status === 404) {
      return { success: false, notFound: true };
    }
    
    if (response.ok) {
      const data = await response.text();
      return { success: true, data };
    }
    
    return { success: false };
  } catch (error) {
    console.error('Download file failed:', error);
    return { success: false };
  }
}

/**
 * 删除远程文件
 */
async function deleteFile(url: string, config: WebDAVConfig): Promise<boolean> {
  try {
    const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'PromptHub/1.0',
      },
    });
    return response.ok || response.status === 204 || response.status === 404;
  } catch {
    return false;
  }
}

/**
 * 确保远程目录存在 (MKCOL)
 * 优先使用主进程 IPC 绕过 CORS
 */
async function ensureDirectory(url: string, config: WebDAVConfig) {
  try {
    // 优先使用主进程 IPC（绕过 CORS）
    if (window.electron?.webdav?.ensureDirectory) {
      await window.electron.webdav.ensureDirectory(url, config);
      return;
    }
    
    // 回退到 fetch（仅在打包后的 Electron 中有效）
    const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
    const checkRes = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Depth': '0',
        'User-Agent': 'PromptHub/1.0',
      }
    });

    if (checkRes.ok || checkRes.status === 207) {
      return;
    }

    await fetch(url, {
      method: 'MKCOL',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'PromptHub/1.0',
      }
    });
  } catch (e) {
    console.warn('Failed to ensure directory:', e);
  }
}

/**
 * 测试 WebDAV 连接
 * 优先使用主进程 IPC 绕过 CORS
 */
export async function testConnection(config: WebDAVConfig): Promise<SyncResult> {
  try {
    // 优先使用主进程 IPC（绕过 CORS）
    if (window.electron?.webdav?.testConnection) {
      const result = await window.electron.webdav.testConnection(config);
      return result;
    }
    
    // 回退到 fetch（仅在打包后的 Electron 中有效）
    const response = await fetch(config.url, {
      method: 'PROPFIND',
      headers: {
        'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
        'Depth': '0',
        'User-Agent': 'PromptHub/1.0',
      },
    });

    if (response.ok || response.status === 207) {
      return { success: true, message: '连接成功' };
    } else if (response.status === 401) {
      return { success: false, message: '认证失败，请检查用户名和密码' };
    } else {
      return { success: false, message: `连接失败: ${response.status} ${response.statusText}` };
    }
  } catch (error) {
    return { success: false, message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}` };
  }
}

/**
 * 收集所有需要同步的图片
 */
async function collectImages(prompts: any[]): Promise<{ [fileName: string]: string }> {
  const images: { [fileName: string]: string } = {};
  const imageFileNames = new Set<string>();

  // 收集所有 prompt 中引用的图片
  for (const prompt of prompts) {
    if (prompt.images && Array.isArray(prompt.images)) {
      for (const img of prompt.images) {
        imageFileNames.add(img);
      }
    }
  }

  // 读取图片为 Base64
  for (const fileName of imageFileNames) {
    try {
      const base64 = await window.electron?.readImageBase64?.(fileName);
      if (base64) {
        images[fileName] = base64;
      }
    } catch (error) {
      console.warn(`Failed to read image ${fileName}:`, error);
    }
  }

  return images;
}

/**
 * 获取 AI 配置（从 localStorage）
 */
function getAiConfig(): BackupData['aiConfig'] {
  try {
    const primary = localStorage.getItem('prompthub-settings');
    const legacy = localStorage.getItem('settings-storage');
    const raw = primary || legacy;
    if (!raw) return undefined;
    const data = JSON.parse(raw);
    const state = data?.state;
    if (!state) return undefined;
    return {
      aiModels: state.aiModels || [],
      aiProvider: state.aiProvider,
      aiApiKey: state.aiApiKey,
      aiApiUrl: state.aiApiUrl,
      aiModel: state.aiModel,
    };
  } catch (error) {
    console.warn('Failed to get AI config:', error);
  }
  return undefined;
}

/**
 * 获取系统设置快照（从 localStorage）
 */
function getSettingsSnapshot(): { state?: any; settingsUpdatedAt?: string } | undefined {
  try {
    const raw = localStorage.getItem('prompthub-settings');
    if (!raw) return undefined;
    const data = JSON.parse(raw);
    const state = data?.state;
    if (!state) return undefined;
    return {
      state,
      settingsUpdatedAt: state.settingsUpdatedAt,
    };
  } catch (error) {
    console.warn('Failed to get settings snapshot:', error);
    return undefined;
  }
}

/**
 * 恢复 AI 配置（到 localStorage）
 */
function restoreAiConfig(aiConfig: BackupData['aiConfig']): void {
  if (!aiConfig) return;
  
  try {
    const primaryKey = 'prompthub-settings';
    const legacyKey = 'settings-storage';
    const storedPrimary = localStorage.getItem(primaryKey);
    const storedLegacy = localStorage.getItem(legacyKey);
    const targetKey = storedPrimary ? primaryKey : (storedLegacy ? legacyKey : primaryKey);
    const stored = storedPrimary || storedLegacy;
    const data = stored ? JSON.parse(stored) : { state: {} };
    if (!data.state) data.state = {};

    // 只更新 AI 相关配置
    if (aiConfig.aiModels) data.state.aiModels = aiConfig.aiModels;
    if (aiConfig.aiProvider) data.state.aiProvider = aiConfig.aiProvider;
    if (aiConfig.aiApiKey) data.state.aiApiKey = aiConfig.aiApiKey;
    if (aiConfig.aiApiUrl) data.state.aiApiUrl = aiConfig.aiApiUrl;
    if (aiConfig.aiModel) data.state.aiModel = aiConfig.aiModel;
    localStorage.setItem(targetKey, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to restore AI config:', error);
  }
}

/**
 * 恢复系统设置（到 localStorage）
 */
function restoreSettingsSnapshot(settings: BackupData['settings']): void {
  if (!settings?.state) return;
  try {
    localStorage.setItem('prompthub-settings', JSON.stringify({ state: settings.state }));
  } catch (error) {
    console.warn('Failed to restore settings snapshot:', error);
  }
}

/**
 * 上传数据到 WebDAV（包含图片、版本历史和 AI 配置）
 * 优先使用主进程 IPC 绕过 CORS
 * @param config WebDAV 配置
 * @param options 同步选项（可选）
 */
export async function uploadToWebDAV(config: WebDAVConfig, options?: WebDAVSyncOptions): Promise<SyncResult> {
  // 默认使用增量同步
  if (options?.incrementalSync !== false) {
    return await incrementalUpload(config, options);
  }
  
  try {
    // 全量备份模式（兼容旧版）
    const fullBackup = await exportDatabase();
    
    // 根据选项决定是否包含图片
    const includeImages = options?.includeImages ?? true;
    const images = includeImages ? fullBackup.images : undefined;
    const imagesCount = images ? Object.keys(images).length : 0;
    
    const backupData: BackupData = {
      version: '3.0',  // 升级版本号
      exportedAt: new Date().toISOString(),
      prompts: fullBackup.prompts,
      folders: fullBackup.folders,
      versions: fullBackup.versions,  // 包含版本历史
      images,
      aiConfig: fullBackup.aiConfig,
      settings: fullBackup.settings,
      settingsUpdatedAt: fullBackup.settingsUpdatedAt,
    };

    // Ensure remote directory exists
    await ensureDirectory(config.url, config);

    const fileUrl = `${config.url.replace(/\/$/, '')}/${BACKUP_FILENAME}`;
    let bodyString: string;
    
    // 如果提供了加密密码，则只加密非图片数据
    if (options?.encryptionPassword) {
      try {
        // 分离图片数据，只加密其他数据
        const dataToEncrypt = {
          version: backupData.version,
          exportedAt: backupData.exportedAt,
          prompts: backupData.prompts,
          folders: backupData.folders,
          versions: backupData.versions,
          aiConfig: backupData.aiConfig,
          settings: backupData.settings,
          settingsUpdatedAt: backupData.settingsUpdatedAt,
        };
        const encryptedContent = await encryptData(JSON.stringify(dataToEncrypt), options.encryptionPassword);
        // 图片不加密，单独存储
        bodyString = JSON.stringify({ 
          encrypted: true, 
          data: encryptedContent,
          images: backupData.images,  // 图片不加密
        });
      } catch (error) {
        return { success: false, message: `加密失败: ${error instanceof Error ? error.message : '未知错误'}` };
      }
    } else {
      bodyString = JSON.stringify(backupData, null, 2);
    }
    
    const promptsCount = fullBackup.prompts.length;
    const versionsCount = fullBackup.versions?.length || 0;
    
    // 优先使用主进程 IPC（绕过 CORS）
    if (window.electron?.webdav?.upload) {
      const result = await window.electron.webdav.upload(fileUrl, config, bodyString);
      if (result.success) {
        return { 
          success: true, 
          message: `上传成功 (${promptsCount} 条 Prompt, ${versionsCount} 个版本, ${imagesCount} 张图片)`,
          timestamp: new Date().toISOString(),
          details: {
            promptsUploaded: promptsCount,
            imagesUploaded: imagesCount,
          },
        };
      } else {
        return { success: false, message: `上传失败: ${result.error}` };
      }
    }
    
    // 回退到 fetch（仅在打包后的 Electron 中有效）
    const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
    const bodyBlob = new Blob([bodyString], { type: 'application/json' });
    
    const response = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Content-Length': String(bodyBlob.size),
        'User-Agent': 'PromptHub/1.0',
      },
      body: bodyBlob,
    });

    if (response.ok || response.status === 201 || response.status === 204) {
      return { 
        success: true, 
        message: `上传成功 (${promptsCount} 条 Prompt, ${versionsCount} 个版本, ${imagesCount} 张图片)`,
        timestamp: new Date().toISOString(),
        details: {
          promptsUploaded: promptsCount,
          imagesUploaded: imagesCount,
        },
      };
    } else {
      return { success: false, message: `上传失败: ${response.status} ${response.statusText}` };
    }
  } catch (error) {
    return { success: false, message: `上传失败: ${error instanceof Error ? error.message : '未知错误'}` };
  }
}

/**
 * 恢复图片到本地
 */
async function restoreImages(images: { [fileName: string]: string }): Promise<number> {
  let restoredCount = 0;
  
  for (const [fileName, base64] of Object.entries(images)) {
    try {
      const success = await window.electron?.saveImageBase64?.(fileName, base64);
      if (success) {
        restoredCount++;
      }
    } catch (error) {
      console.warn(`Failed to restore image ${fileName}:`, error);
    }
  }
  
  return restoredCount;
}

/**
 * 增量上传到 WebDAV
 * 只上传有变化的文件，大幅减少流量消耗
 */
export async function incrementalUpload(config: WebDAVConfig, options?: WebDAVSyncOptions): Promise<SyncResult> {
  try {
    const baseUrl = config.url.replace(/\/$/, '');
    const backupDirUrl = `${baseUrl}/${BACKUP_DIR}`;
    const imagesDirUrl = `${backupDirUrl}/${IMAGES_DIR}`;
    const manifestUrl = `${backupDirUrl}/${MANIFEST_FILENAME}`;
    const dataUrl = `${backupDirUrl}/${DATA_FILENAME}`;
    
    // 确保目录结构存在
    await ensureDirectory(backupDirUrl, config);
    if (options?.includeImages !== false) {
      await ensureDirectory(imagesDirUrl, config);
    }
    
    // 获取完整数据
    const fullBackup = await exportDatabase();
    const includeImages = options?.includeImages !== false;
    
    // 准备核心数据（不含图片）
    const coreData = {
      version: '4.0',
      exportedAt: new Date().toISOString(),
      prompts: fullBackup.prompts,
      folders: fullBackup.folders,
      versions: fullBackup.versions,
      aiConfig: fullBackup.aiConfig,
      settings: fullBackup.settings,
      settingsUpdatedAt: fullBackup.settingsUpdatedAt,
    };
    
    let dataString = JSON.stringify(coreData);
    
    // 加密处理
    if (options?.encryptionPassword) {
      const encryptedContent = await encryptData(dataString, options.encryptionPassword);
      dataString = JSON.stringify({ encrypted: true, data: encryptedContent });
    }
    
    const dataHash = await computeHash(dataString);
    
    // 获取远程 manifest
    let remoteManifest: BackupManifest | null = null;
    const manifestResult = await downloadFile(manifestUrl, config);
    if (manifestResult.success && manifestResult.data) {
      try {
        remoteManifest = JSON.parse(manifestResult.data);
      } catch {
        remoteManifest = null;
      }
    }
    
    let uploadedCount = 0;
    let skippedCount = 0;
    let imagesUploaded = 0;
    
    // 检查数据是否需要更新
    if (!remoteManifest || remoteManifest.dataHash !== dataHash) {
      const success = await uploadFile(dataUrl, config, dataString);
      if (!success) {
        return { success: false, message: '上传数据文件失败' };
      }
      uploadedCount++;
      console.log('📤 Uploaded data.json (changed)');
    } else {
      skippedCount++;
      console.log('⏭️ Skipped data.json (unchanged)');
    }
    
    // 处理图片增量上传
    const newImageManifest: BackupManifest['images'] = {};
    
    if (includeImages && fullBackup.images) {
      for (const [fileName, base64] of Object.entries(fullBackup.images)) {
        const imageHash = await computeHash(base64);
        const remoteImage = remoteManifest?.images?.[fileName];
        
        // 检查图片是否需要更新
        if (!remoteImage || remoteImage.hash !== imageHash) {
          const imageUrl = `${imagesDirUrl}/${encodeURIComponent(fileName)}.base64`;
          const success = await uploadFile(imageUrl, config, base64);
          if (success) {
            imagesUploaded++;
            console.log(`📤 Uploaded image: ${fileName}`);
          }
        } else {
          skippedCount++;
          console.log(`⏭️ Skipped image: ${fileName} (unchanged)`);
        }
        
        newImageManifest[fileName] = {
          hash: imageHash,
          size: base64.length,
          uploadedAt: new Date().toISOString(),
        };
      }
    }
    
    // 更新 manifest
    const newManifest: BackupManifest = {
      version: '4.0',
      createdAt: remoteManifest?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dataHash,
      images: newImageManifest,
      encrypted: !!options?.encryptionPassword,
    };
    
    const manifestSuccess = await uploadFile(manifestUrl, config, JSON.stringify(newManifest, null, 2));
    if (!manifestSuccess) {
      return { success: false, message: '上传 manifest 失败' };
    }
    
    const promptsCount = fullBackup.prompts.length;
    const versionsCount = fullBackup.versions?.length || 0;
    const totalImages = Object.keys(newImageManifest).length;
    
    return {
      success: true,
      message: `增量上传完成 (${promptsCount} 条 Prompt, ${versionsCount} 个版本, ${imagesUploaded}/${totalImages} 张图片更新, ${skippedCount} 个文件跳过)`,
      timestamp: new Date().toISOString(),
      details: {
        promptsUploaded: promptsCount,
        imagesUploaded,
        skipped: skippedCount,
      },
    };
  } catch (error) {
    return { success: false, message: `增量上传失败: ${error instanceof Error ? error.message : '未知错误'}` };
  }
}

/**
 * 增量下载从 WebDAV
 * 只下载有变化的文件
 */
export async function incrementalDownload(config: WebDAVConfig, options?: WebDAVSyncOptions): Promise<SyncResult> {
  try {
    const baseUrl = config.url.replace(/\/$/, '');
    const backupDirUrl = `${baseUrl}/${BACKUP_DIR}`;
    const imagesDirUrl = `${backupDirUrl}/${IMAGES_DIR}`;
    const manifestUrl = `${backupDirUrl}/${MANIFEST_FILENAME}`;
    const dataUrl = `${backupDirUrl}/${DATA_FILENAME}`;
    
    // 下载 manifest
    const manifestResult = await downloadFile(manifestUrl, config);
    if (!manifestResult.success || !manifestResult.data) {
      // 尝试兼容旧版单文件备份
      return await downloadFromWebDAV(config, options);
    }
    
    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(manifestResult.data);
    } catch {
      return { success: false, message: 'manifest 文件格式错误' };
    }
    
    // 下载数据文件
    const dataResult = await downloadFile(dataUrl, config);
    if (!dataResult.success || !dataResult.data) {
      return { success: false, message: '下载数据文件失败' };
    }
    
    let coreData: any;
    
    // 处理加密
    if (manifest.encrypted) {
      if (!options?.encryptionPassword) {
        return { success: false, message: '数据已加密，请提供解密密码' };
      }
      try {
        const parsed = JSON.parse(dataResult.data);
        const decrypted = await decryptData(parsed.data, options.encryptionPassword);
        coreData = JSON.parse(decrypted);
      } catch {
        return { success: false, message: '解密失败，密码可能不正确' };
      }
    } else {
      coreData = JSON.parse(dataResult.data);
    }
    
    // 恢复核心数据
    await restoreFromBackup({
      version: typeof coreData.version === 'string' ? parseInt(coreData.version) || 1 : coreData.version as number,
      exportedAt: coreData.exportedAt,
      prompts: coreData.prompts,
      folders: coreData.folders,
      versions: coreData.versions || [],
    });
    
    // 下载图片
    let imagesDownloaded = 0;
    if (manifest.images && Object.keys(manifest.images).length > 0) {
      for (const [fileName] of Object.entries(manifest.images)) {
        const imageUrl = `${imagesDirUrl}/${encodeURIComponent(fileName)}.base64`;
        const imageResult = await downloadFile(imageUrl, config);
        if (imageResult.success && imageResult.data) {
          const success = await window.electron?.saveImageBase64?.(fileName, imageResult.data);
          if (success) {
            imagesDownloaded++;
          }
        }
      }
    }
    
    // 恢复 AI 配置和设置
    if (coreData.aiConfig) {
      restoreAiConfig(coreData.aiConfig);
    }
    if (coreData.settings) {
      restoreSettingsSnapshot(coreData.settings);
    }
    
    return {
      success: true,
      message: `增量下载完成 (${coreData.prompts?.length || 0} 条 Prompt, ${imagesDownloaded} 张图片)`,
      timestamp: coreData.exportedAt,
      details: {
        promptsDownloaded: coreData.prompts?.length || 0,
        imagesDownloaded,
      },
    };
  } catch (error) {
    return { success: false, message: `增量下载失败: ${error instanceof Error ? error.message : '未知错误'}` };
  }
}

/**
 * 从 WebDAV 下载数据（包含图片、版本历史）
 * 优先使用主进程 IPC 绕过 CORS
 * @param config WebDAV 配置
 * @param options 同步选项（可选，用于解密）
 */
export async function downloadFromWebDAV(config: WebDAVConfig, options?: WebDAVSyncOptions): Promise<SyncResult> {
  // 默认使用增量同步
  if (options?.incrementalSync !== false) {
    // 先尝试增量下载
    const baseUrl = config.url.replace(/\/$/, '');
    const manifestUrl = `${baseUrl}/${BACKUP_DIR}/${MANIFEST_FILENAME}`;
    const manifestResult = await downloadFile(manifestUrl, config);
    if (manifestResult.success && manifestResult.data) {
      return await incrementalDownload(config, options);
    }
    // 如果没有增量备份，回退到旧版
  }
  
  try {
    const fileUrl = `${config.url.replace(/\/$/, '')}/${BACKUP_FILENAME}`;
    
    let data: BackupData;
    let rawData: string;
    
    // 优先使用主进程 IPC（绕过 CORS）
    if (window.electron?.webdav?.download) {
      const result = await window.electron.webdav.download(fileUrl, config);
      if (result.notFound) {
        return { success: false, message: '远程没有备份文件' };
      }
      if (!result.success || !result.data) {
        return { success: false, message: `下载失败: ${result.error}` };
      }
      rawData = result.data;
    } else {
      // 回退到 fetch（仅在打包后的 Electron 中有效）
      const response = await fetch(fileUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
        },
      });

      if (response.status === 404) {
        return { success: false, message: '远程没有备份文件' };
      }

      if (!response.ok) {
        return { success: false, message: `下载失败: ${response.status} ${response.statusText}` };
      }

      rawData = await response.text();
    }
    
    // 解析数据，检查是否加密
    const parsed = JSON.parse(rawData);
    let images: { [fileName: string]: string } | undefined;
    
    if (parsed.encrypted && parsed.data) {
      // 数据已加密，需要解密
      if (!options?.encryptionPassword) {
        return { success: false, message: '数据已加密，请提供解密密码' };
      }
      try {
        const decrypted = await decryptData(parsed.data, options.encryptionPassword);
        data = JSON.parse(decrypted);
        // 图片是未加密的，从 parsed 中获取
        images = parsed.images;
      } catch (error) {
        return { success: false, message: '解密失败，密码可能不正确' };
      }
    } else {
      data = parsed;
      images = data.images;
    }
    
    // 恢复数据 - 转换为 DatabaseBackup 格式
    await restoreFromBackup({
      version: typeof data.version === 'string' ? parseInt(data.version) || 1 : data.version as number,
      exportedAt: data.exportedAt,
      prompts: data.prompts,
      folders: data.folders,
      versions: data.versions || [],
    });
    
    // 恢复图片（使用正确的图片数据源）
    let imagesRestored = 0;
    if (images && Object.keys(images).length > 0) {
      imagesRestored = await restoreImages(images);
    }
    
    // 恢复 AI 配置
    if (data.aiConfig) {
      restoreAiConfig(data.aiConfig);
    }

    // 恢复系统设置
    if (data.settings) {
      restoreSettingsSnapshot(data.settings);
    }
    
    return { 
      success: true, 
      message: `下载成功 (${data.prompts?.length || 0} 条 Prompt, ${imagesRestored} 张图片${data.aiConfig ? ', AI配置已同步' : ''}${data.settings ? ', 设置已同步' : ''})`,
      timestamp: data.exportedAt,
      details: {
        promptsDownloaded: data.prompts?.length || 0,
        imagesDownloaded: imagesRestored,
      },
    };
  } catch (error) {
    return { success: false, message: `下载失败: ${error instanceof Error ? error.message : '未知错误'}` };
  }
}

/**
 * 获取远程备份信息（包含详细数据）
 * 优先使用主进程 IPC 绕过 CORS
 */
export async function getRemoteBackupInfo(config: WebDAVConfig): Promise<{ 
  exists: boolean; 
  timestamp?: string;
  data?: BackupData;
}> {
  try {
    const fileUrl = `${config.url.replace(/\/$/, '')}/${BACKUP_FILENAME}`;
    
    // 优先使用主进程 IPC（绕过 CORS）
    if (window.electron?.webdav?.download) {
      const result = await window.electron.webdav.download(fileUrl, config);
      if (result.notFound || !result.success || !result.data) {
        return { exists: false };
      }
      const data: BackupData = JSON.parse(result.data);
      return { 
        exists: true, 
        timestamp: data.exportedAt,
        data,
      };
    }
    
    // 回退到 fetch（仅在打包后的 Electron 中有效）
    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
      },
    });

    if (response.status === 404) {
      return { exists: false };
    }

    if (response.ok) {
      const data: BackupData = await response.json();
      return { 
        exists: true, 
        timestamp: data.exportedAt,
        data,
      };
    }

    return { exists: false };
  } catch {
    return { exists: false };
  }
}

/**
 * 双向智能同步
 * 比较本地和远程数据的时间戳，自动决定同步方向
 * @param config WebDAV 配置
 * @param options 同步选项（可选）
 */
export async function bidirectionalSync(config: WebDAVConfig, options?: WebDAVSyncOptions): Promise<SyncResult> {
  try {
    // 获取本地数据
    const localPrompts = await getAllPrompts();
    const localFolders = await getAllFolders();
    
    // 获取本地最新更新时间
    let localLatestTime = new Date(0);
    for (const prompt of localPrompts) {
      const updatedAt = new Date(prompt.updatedAt);
      if (updatedAt > localLatestTime) {
        localLatestTime = updatedAt;
      }
    }
    for (const folder of localFolders) {
      const updatedAt = new Date(folder.updatedAt);
      if (updatedAt > localLatestTime) {
        localLatestTime = updatedAt;
      }
    }

    // 设置更新时间也纳入比较（保证换设备配置一致）
    try {
      const raw = localStorage.getItem('prompthub-settings');
      if (raw) {
        const data = JSON.parse(raw);
        const settingsUpdatedAt = data?.state?.settingsUpdatedAt;
        if (settingsUpdatedAt) {
          const t = new Date(settingsUpdatedAt);
          if (t > localLatestTime) localLatestTime = t;
        }
      }
    } catch {
      // ignore
    }
    
    // 获取远程备份信息
    const remoteInfo = await getRemoteBackupInfo(config);
    
    // 如果远程没有数据，上传本地数据
    if (!remoteInfo.exists || !remoteInfo.data) {
      console.log('🔄 Remote is empty, uploading local data...');
      return await uploadToWebDAV(config, options);
    }
    
    const remoteTime = new Date(remoteInfo.timestamp || 0);
    
    // 比较时间戳决定同步方向
    if (remoteTime > localLatestTime) {
      // 远程数据更新，下载
      console.log('🔄 Remote is newer, downloading...');
      return await downloadFromWebDAV(config, options);
    } else if (localLatestTime > remoteTime) {
      // 本地数据更新，上传
      console.log('🔄 Local is newer, uploading...');
      return await uploadToWebDAV(config, options);
    } else {
      // 数据一致，无需同步
      return {
        success: true,
        message: '数据已是最新，无需同步',
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `同步失败: ${error instanceof Error ? error.message : '未知错误'}` 
    };
  }
}

/**
 * 自动同步（用于启动时和定时同步）
 * 默认采用双向同步策略
 * @param config WebDAV 配置
 * @param options 同步选项（可选）
 */
export async function autoSync(config: WebDAVConfig, options?: WebDAVSyncOptions): Promise<SyncResult> {
  return await bidirectionalSync(config, options);
}
