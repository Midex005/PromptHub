import { useState, useEffect } from 'react';
import { XIcon, FolderIcon, TrashIcon, LockIcon } from 'lucide-react';
import { useFolderStore } from '../../stores/folder.store';
import type { Folder } from '../../../shared/types';
import { useToast } from '../ui/Toast';

// 可选的文件夹图标 - 分类整理
const FOLDER_ICON_CATEGORIES = [
  {
    name: '常用',
    icons: ['📁', '📂', '🗂️', '📋', '📌', '⭐', '❤️', '🔥', '✨', '💎'],
  },
  {
    name: '工作',
    icons: ['💼', '📊', '📈', '💻', '🖥️', '⌨️', '🔧', '⚙️', '🛠️', '📱'],
  },
  {
    name: '学习',
    icons: ['📚', '📖', '📝', '✏️', '🎓', '🔬', '🧪', '💡', '🧠', '📐'],
  },
  {
    name: '创意',
    icons: ['🎨', '🎭', '🎬', '📷', '🎵', '🎮', '🎯', '🚀', '🌈', '🎪'],
  },
  {
    name: '生活',
    icons: ['🏠', '🌍', '🌸', '🍀', '☀️', '🌙', '⛅', '🎁', '🎉', '🎊'],
  },
  {
    name: '符号',
    icons: ['💬', '💭', '📢', '🔔', '🔒', '🔑', '🏷️', '📎', '🔗', '📍'],
  },
];

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder?: Folder | null; // 编辑模式时传入
}

export function FolderModal({ isOpen, onClose, folder }: FolderModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<{ configured: boolean; unlocked: boolean }>({ configured: false, unlocked: false });
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  const createFolder = useFolderStore((state) => state.createFolder);
  const updateFolder = useFolderStore((state) => state.updateFolder);
  const deleteFolder = useFolderStore((state) => state.deleteFolder);

  const isEditMode = !!folder;

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setIcon(folder.icon || '📁');
      setIsPrivate(folder.isPrivate || false);
    } else {
      setName('');
      setIcon('📁');
      setIsPrivate(false);
    }
    window.api?.security?.status?.().then((s) => setSecurityStatus(s)).catch(() => {});
  }, [folder, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // 如果开启私密且当前未解锁，要求先解锁
    if (isPrivate && securityStatus.configured && !securityStatus.unlocked) {
      setShowUnlockModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && folder) {
        await updateFolder(folder.id, {
          name: name.trim(),
          icon,
          isPrivate,
        });
      } else {
        await createFolder({
          name: name.trim(),
          icon,
          isPrivate
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save folder:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async () => {
    if (!unlockPassword.trim()) {
      showToast('请输入主密码', 'error');
      return;
    }
    setUnlocking(true);
    try {
      const result = await window.api.security.unlock(unlockPassword);
      if (result.success) {
        showToast('解锁成功', 'success');
        setSecurityStatus({ ...securityStatus, unlocked: true });
        setShowUnlockModal(false);
        setUnlockPassword('');
        // 解锁后继续保存
        handleSubmit({ preventDefault: () => {} } as any);
      } else {
        showToast('密码错误', 'error');
      }
    } catch (error) {
      showToast('解锁失败', 'error');
    } finally {
      setUnlocking(false);
    }
  };

  const handleDelete = async () => {
    if (!folder) return;
    // 私密文件夹删除需要验证主密码
    if (folder.isPrivate && securityStatus.configured) {
      setShowDeleteConfirm(true);
    } else {
      if (!confirm(`确定要删除文件夹「${folder.name}」吗？`)) return;
      try {
        await deleteFolder(folder.id);
        onClose();
      } catch (error) {
        console.error('Failed to delete folder:', error);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!folder) return;
    if (!deletePassword.trim()) {
      showToast('请输入主密码', 'error');
      return;
    }
    setDeleting(true);
    try {
      const result = await window.api.security.unlock(deletePassword);
      if (result.success) {
        await deleteFolder(folder.id);
        showToast('删除成功', 'success');
        setShowDeleteConfirm(false);
        setDeletePassword('');
        onClose();
      } else {
        showToast('主密码错误，无法删除', 'error');
      }
    } catch (error) {
      showToast('删除失败', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* 背景遮罩 */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        {/* 弹窗内容 */}
        <div className="relative bg-card rounded-xl w-full max-w-md mx-4 overflow-hidden border border-border">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {isEditMode ? '编辑文件夹' : '新建文件夹'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <XIcon className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* 图标选择 */}
          <div>
            <label className="block text-sm font-medium mb-2">图标</label>
            <div className="max-h-48 overflow-y-auto space-y-3 pr-2">
              {FOLDER_ICON_CATEGORIES.map((category) => (
                <div key={category.name}>
                  <div className="text-xs text-muted-foreground mb-1.5">{category.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {category.icons.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setIcon(emoji)}
                        className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${icon === emoji
                          ? 'bg-primary text-white'
                          : 'bg-muted hover:bg-muted/80'
                          }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 名称输入 */}
          <div>
            <label className="block text-sm font-medium mb-2">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入文件夹名称"
              className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground/50"
              autoFocus
            />
          </div>

          {/* 隐私设置 */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                if (!securityStatus.configured) {
                  showToast('请先在设置-安全中设置主密码后再开启私密', 'error');
                  setIsPrivate(false);
                  return;
                }
                setIsPrivate((v) => !v);
              }}
              className="w-full flex items-center justify-between rounded-lg border border-border bg-muted/60 hover:bg-muted px-3 py-2 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <LockIcon className="w-3.5 h-3.5 text-muted-foreground" />
                设为私密文件夹
              </span>
              <span
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  isPrivate ? 'bg-primary/80' : 'bg-border'
                }`}
                aria-hidden="true"
              >
                <span
                  className={`absolute left-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform ${
                    isPrivate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            {isPrivate && (
              <div className="pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
                {!securityStatus.configured ? (
                  <p className="text-xs text-destructive">请到"设置 - 安全"设置主密码后再开启私密。</p>
                ) : (
                  <p className="text-xs text-muted-foreground">保存后此文件夹内容将加密存储，进入时需要验证密码。</p>
                )}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between pt-2">
            {isEditMode ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-sm"
              >
                <TrashIcon className="w-4 h-4" />
                删除
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-lg bg-muted text-sm hover:bg-muted/80 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    {/* 解锁主密码弹窗 */}
    {showUnlockModal && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={() => setShowUnlockModal(false)} />
        <div className="relative bg-card rounded-xl w-full max-w-sm mx-4 p-5 border border-border space-y-4">
          <h3 className="text-base font-semibold">输入主密码</h3>
          <p className="text-xs text-muted-foreground">保存私密文件夹前需要先解锁主密码</p>
          <input
            type="password"
            value={unlockPassword}
            onChange={(e) => setUnlockPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUnlock();
            }}
            placeholder="请输入主密码"
            className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground/50"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setShowUnlockModal(false);
                setUnlockPassword('');
              }}
              className="h-9 px-4 rounded-lg bg-muted text-sm hover:bg-muted/80 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleUnlock}
              disabled={unlocking}
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {unlocking ? '解锁中...' : '解锁'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 删除私密文件夹确认弹窗 */}
    {showDeleteConfirm && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
        <div className="relative bg-card rounded-xl w-full max-w-sm mx-4 p-5 border border-border space-y-4">
          <h3 className="text-base font-semibold text-destructive">删除私密文件夹</h3>
          <p className="text-xs text-muted-foreground">
            此操作将删除文件夹「{folder?.name}」及其内的所有加密内容，请输入主密码确认
          </p>
          <input
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDeleteConfirm();
            }}
            placeholder="请输入主密码"
            className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground/50"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeletePassword('');
              }}
              className="h-9 px-4 rounded-lg bg-muted text-sm hover:bg-muted/80 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="h-9 px-4 rounded-lg bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {deleting ? '删除中...' : '确认删除'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
