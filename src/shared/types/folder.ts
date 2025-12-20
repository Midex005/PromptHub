/**
 * Folder type definitions
 * 文件夹类型定义
 */

export interface Folder {
  id: string;
  name: string;
  icon?: string; // emoji
  parentId?: string;
  order: number;
  isPrivate?: boolean;
  createdAt: string;  // ISO 8601 format / ISO 8601 格式
  updatedAt: string;  // ISO 8601 format / ISO 8601 格式
}

export interface CreateFolderDTO {
  name: string;
  icon?: string;
  parentId?: string;
  isPrivate?: boolean;
}

export interface UpdateFolderDTO {
  name?: string;
  icon?: string;
  parentId?: string;
  order?: number;
  isPrivate?: boolean;
}
