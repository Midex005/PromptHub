/**
 * IPC 通信通道定义
 */

export const IPC_CHANNELS = {
  // Prompt
  PROMPT_CREATE: 'prompt:create',
  PROMPT_GET: 'prompt:get',
  PROMPT_GET_ALL: 'prompt:getAll',
  PROMPT_UPDATE: 'prompt:update',
  PROMPT_DELETE: 'prompt:delete',
  PROMPT_SEARCH: 'prompt:search',
  PROMPT_COPY: 'prompt:copy',

  // Version
  VERSION_GET_ALL: 'version:getAll',
  VERSION_CREATE: 'version:create',
  VERSION_ROLLBACK: 'version:rollback',
  VERSION_DIFF: 'version:diff',

  // Folder
  FOLDER_CREATE: 'folder:create',
  FOLDER_GET_ALL: 'folder:getAll',
  FOLDER_UPDATE: 'folder:update',
  FOLDER_DELETE: 'folder:delete',
  FOLDER_REORDER: 'folder:reorder',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Import/Export
  EXPORT_PROMPTS: 'export:prompts',
  IMPORT_PROMPTS: 'import:prompts',

  // Security / Encryption
  SECURITY_SET_MASTER_PASSWORD: 'security:setMasterPassword',
  SECURITY_UNLOCK: 'security:unlock',
  SECURITY_STATUS: 'security:status',
  SECURITY_LOCK: 'security:lock',
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
