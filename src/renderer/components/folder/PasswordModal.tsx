import { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui';
import { useTranslation } from 'react-i18next';

interface PasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (password: string) => void;
    title?: string;
}

export function PasswordModal({ isOpen, onClose, onSubmit, title }: PasswordModalProps) {
    const { t } = useTranslation();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!password.trim()) {
            setError(t('folder.passwordRequired', 'Please enter password / 请输入密码'));
            return;
        }
        onSubmit(password);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title || t('folder.enterPassword', 'Enter password / 输入密码')}
            size="sm"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    type="password"
                    placeholder={t('folder.passwordPlaceholder', 'Please enter folder password / 请输入文件夹密码')}
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                    }}
                    autoFocus
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} type="button">
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" type="submit">
                        {t('common.confirm')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
