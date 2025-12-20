import { globalShortcut, BrowserWindow, ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';

// Shortcut config storage path
// 快捷键配置存储路径
const getShortcutsPath = () => path.join(app.getPath('userData'), 'shortcuts.json');

// Default shortcut configuration
// 默认快捷键配置
// Notes: prefer uncommon combos to avoid conflicts with system/common shortcuts
// 注意：使用不常用的组合键，避免与系统和常用应用冲突
// - Avoid Cmd/Ctrl+N (new), Cmd/Ctrl+F (find), Cmd/Ctrl+, (settings), etc.
// - 避免 Cmd/Ctrl+N (新建)、Cmd/Ctrl+F (搜索)、Cmd/Ctrl+, (设置) 等常用快捷键
// - Use Alt/Option combos to reduce conflicts
// - 使用 Alt/Option 组合键更不容易冲突
const DEFAULT_SHORTCUTS: Record<string, string> = {
  showApp: 'Alt+Shift+P',           // Show/hide app
                                   // 显示/隐藏应用
  newPrompt: 'Alt+Shift+N',         // Create new prompt
                                   // 新建 Prompt
  search: 'Alt+Shift+F',            // Search
                                   // 搜索
  settings: 'Alt+Shift+S',          // Open settings
                                   // 打开设置
};

// Current shortcut configuration
// 当前快捷键配置
let currentShortcuts: Record<string, string> = { ...DEFAULT_SHORTCUTS };

/**
 * Load shortcut configuration
 * 加载快捷键配置
 */
function loadShortcuts(): Record<string, string> {
  try {
    const shortcutsPath = getShortcutsPath();
    if (fs.existsSync(shortcutsPath)) {
      const data = fs.readFileSync(shortcutsPath, 'utf-8');
      return { ...DEFAULT_SHORTCUTS, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Failed to load shortcuts:', error);
  }
  return { ...DEFAULT_SHORTCUTS };
}

/**
 * Save shortcut configuration
 * 保存快捷键配置
 */
function saveShortcuts(shortcuts: Record<string, string>): boolean {
  try {
    const shortcutsPath = getShortcutsPath();
    fs.writeFileSync(shortcutsPath, JSON.stringify(shortcuts, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save shortcuts:', error);
    return false;
  }
}

/**
 * Register a single global shortcut
 * 注册单个全局快捷键
 */
function registerSingleShortcut(action: string, accelerator: string): boolean {
  if (!accelerator) return false;
  
  try {
    const success = globalShortcut.register(accelerator, () => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        const win = windows[0];
        
        // For show-app shortcut: show and focus window
        // 如果是显示应用快捷键，显示并聚焦窗口
        if (action === 'showApp') {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
        
        // Send shortcut event to renderer
        // 发送快捷键触发事件到渲染进程
        win.webContents.send('shortcut:triggered', action);
      }
    });
    
    if (!success) {
      console.warn(`Failed to register shortcut: ${accelerator} for action: ${action}`);
    }
    return success;
  } catch (error) {
    console.error(`Error registering shortcut ${accelerator}:`, error);
    return false;
  }
}

/**
 * Register all global shortcuts
 * 注册全局快捷键
 */
export function registerShortcuts(): void {
  // Load saved shortcut configuration
  // 加载保存的快捷键配置
  currentShortcuts = loadShortcuts();
  
  // Unregister all existing shortcuts
  // 注销所有现有快捷键
  globalShortcut.unregisterAll();
  
  // Register each shortcut
  // 注册每个快捷键
  for (const [action, accelerator] of Object.entries(currentShortcuts)) {
    if (accelerator) {
      registerSingleShortcut(action, accelerator);
    }
  }
}

/**
 * Unregister all global shortcuts
 * 注销所有全局快捷键
 */
export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}

/**
 * Send shortcut event to renderer process
 * 发送快捷键事件到渲染进程
 */
export function sendShortcutToRenderer(channel: string): void {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.webContents.send(channel);
  }
}

/**
 * Register shortcut-related IPC handlers
 * 注册快捷键相关的 IPC 处理程序
 */
export function registerShortcutsIPC(): void {
  // Get shortcut configuration
  // 获取快捷键配置
  ipcMain.handle('shortcuts:get', () => {
    return currentShortcuts;
  });

  // Set shortcut configuration
  // 设置快捷键配置
  ipcMain.handle('shortcuts:set', (_event, shortcuts: Record<string, string>) => {
    currentShortcuts = shortcuts;
    const saved = saveShortcuts(shortcuts);
    
    // Re-register shortcuts
    // 重新注册快捷键
    globalShortcut.unregisterAll();
    for (const [action, accelerator] of Object.entries(shortcuts)) {
      if (accelerator) {
        registerSingleShortcut(action, accelerator);
      }
    }
    
    return saved;
  });
}
