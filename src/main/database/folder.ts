import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Folder, CreateFolderDTO, UpdateFolderDTO } from '@shared/types';

export class FolderDB {
  constructor(private db: Database.Database) {}

  /**
   * 创建文件夹
   */
  create(data: CreateFolderDTO): Folder {
    const id = uuidv4();
    const now = Date.now();

    // 获取最大排序值
    const maxOrder = this.db
      .prepare('SELECT MAX(sort_order) as max FROM folders WHERE parent_id IS ?')
      .get(data.parentId || null) as { max: number | null };

    const order = (maxOrder?.max ?? -1) + 1;

    const stmt = this.db.prepare(`
      INSERT INTO folders (id, name, icon, parent_id, sort_order, is_private, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.icon || null,
      data.parentId || null,
      order,
      data.isPrivate ? 1 : 0,
      now,
      now
    );

    return this.getById(id)!;
  }

  /**
   * 根据 ID 获取文件夹
   */
  getById(id: string): Folder | null {
    const stmt = this.db.prepare('SELECT * FROM folders WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.rowToFolder(row) : null;
  }

  /**
   * 获取所有文件夹
   */
  getAll(): Folder[] {
    const stmt = this.db.prepare('SELECT * FROM folders ORDER BY sort_order ASC');
    const rows = stmt.all() as any[];
    return rows.map((row) => this.rowToFolder(row));
  }

  /**
   * 更新文件夹
   */
  update(id: string, data: UpdateFolderDTO): Folder | null {
    const folder = this.getById(id);
    if (!folder) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.icon !== undefined) {
      updates.push('icon = ?');
      values.push(data.icon);
    }
    if (data.parentId !== undefined) {
      updates.push('parent_id = ?');
      values.push(data.parentId);
    }
    if (data.order !== undefined) {
      updates.push('sort_order = ?');
      values.push(data.order);
    }
    if (data.isPrivate !== undefined) {
      updates.push('is_private = ?');
      values.push(data.isPrivate ? 1 : 0);
    }
    updates.push('updated_at = ?');
    values.push(Date.now());

    if (updates.length === 0) return folder;

    values.push(id);

    const stmt = this.db.prepare(
      `UPDATE folders SET ${updates.join(', ')} WHERE id = ?`
    );
    stmt.run(...values);

    return this.getById(id);
  }

  /**
   * 删除文件夹
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM folders WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 重新排序文件夹
   */
  reorder(ids: string[]): void {
    const stmt = this.db.prepare('UPDATE folders SET sort_order = ? WHERE id = ?');
    const transaction = this.db.transaction(() => {
      ids.forEach((id, index) => {
        stmt.run(index, id);
      });
    });
    transaction();
  }

  /**
   * 数据库行转 Folder 对象
   */
  private rowToFolder(row: any): Folder {
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      parentId: row.parent_id,
      order: row.sort_order,
      isPrivate: !!row.is_private,
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    };
  }
}
