import { useState } from 'react';
import { LockIcon, XIcon } from 'lucide-react';
import { useToast } from '../ui/Toast';

interface PrivateFolderUnlockModalProps {
  isOpen: boolean;
  folderName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PrivateFolderUnlockModal({
  isOpen,
  folderName,
  onClose,
  onSuccess,
}: PrivateFolderUnlockModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleUnlock = async () => {
    if (!password.trim()) {
      showToast('请输入主密码', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await window.api?.security?.unlock(password);
      if (result?.success) {
        showToast('解锁成功', 'success');
        setPassword('');
        onSuccess();
      } else {
        showToast('主密码错误', 'error');
      }
    } catch (error) {
      showToast('解锁失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleUnlock();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 弹窗内容 */}
      <div className="relative bg-card rounded-xl w-full max-w-sm mx-4 overflow-hidden border border-border animate-in fade-in zoom-in-95 duration-200">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <LockIcon className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">解锁私密文件夹</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <XIcon className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            文件夹「<span className="font-medium text-foreground">{folderName}</span>」是私密文件夹，请输入主密码解锁查看。
          </p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入主密码"
            className="w-full h-10 px-3 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground/50"
            autoFocus
          />

          {/* 操作按钮 */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg bg-muted text-sm hover:bg-muted/80 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleUnlock}
              disabled={loading}
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? '解锁中...' : '解锁'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
