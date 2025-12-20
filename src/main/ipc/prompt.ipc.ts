import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { PromptDB } from '../database/prompt';
import type { CreatePromptDTO, UpdatePromptDTO, SearchQuery } from '../../shared/types';

/**
 * Register Prompt-related IPC handlers
 * 注册 Prompt 相关 IPC 处理器
 */
export function registerPromptIPC(db: PromptDB): void {
  // Create Prompt
  // 创建 Prompt
  ipcMain.handle(IPC_CHANNELS.PROMPT_CREATE, async (_, data: CreatePromptDTO) => {
    return db.create(data);
  });

  // Get single Prompt
  // 获取单个 Prompt
  ipcMain.handle(IPC_CHANNELS.PROMPT_GET, async (_, id: string) => {
    return db.getById(id);
  });

  // Get all Prompts
  // 获取所有 Prompt
  ipcMain.handle(IPC_CHANNELS.PROMPT_GET_ALL, async () => {
    return db.getAll();
  });

  // Update Prompt
  // 更新 Prompt
  ipcMain.handle(IPC_CHANNELS.PROMPT_UPDATE, async (_, id: string, data: UpdatePromptDTO) => {
    return db.update(id, data);
  });

  // Delete Prompt
  // 删除 Prompt
  ipcMain.handle(IPC_CHANNELS.PROMPT_DELETE, async (_, id: string) => {
    return db.delete(id);
  });

  // Search Prompts
  // 搜索 Prompt
  ipcMain.handle(IPC_CHANNELS.PROMPT_SEARCH, async (_, query: SearchQuery) => {
    return db.search(query);
  });

  // Copy Prompt (after variable replacement)
  // 复制 Prompt（替换变量后）
  ipcMain.handle(
    IPC_CHANNELS.PROMPT_COPY,
    async (_, id: string, variables: Record<string, string>) => {
      const prompt = db.getById(id);
      if (!prompt) return null;

      // Replace variables
      // 替换变量
      let content = prompt.userPrompt;
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }

      // Update usage count
      // 更新使用次数
      db.incrementUsage(id);

      return content;
    }
  );

  // Get all versions
  // 获取所有版本
  ipcMain.handle(IPC_CHANNELS.VERSION_GET_ALL, async (_, promptId: string) => {
    return db.getVersions(promptId);
  });

  // Create version
  // 创建版本
  ipcMain.handle(IPC_CHANNELS.VERSION_CREATE, async (_, promptId: string, note?: string) => {
    return db.createVersion(promptId, note);
  });

  // Rollback version
  // 回滚版本
  ipcMain.handle(IPC_CHANNELS.VERSION_ROLLBACK, async (_, promptId: string, version: number) => {
    return db.rollback(promptId, version);
  });
}
