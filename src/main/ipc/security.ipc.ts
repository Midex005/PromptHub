import { ipcMain } from 'electron';
import Database from 'better-sqlite3';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { setMasterPassword, unlock, lock, securityStatus } from '../security';

export function registerSecurityIPC(db: Database.Database) {
  ipcMain.handle(IPC_CHANNELS.SECURITY_STATUS, async () => {
    return securityStatus(db);
  });

  ipcMain.handle(IPC_CHANNELS.SECURITY_SET_MASTER_PASSWORD, async (_e, password: string) => {
    if (!password || password.length < 4) {
      throw new Error('Password too short');
    }
    setMasterPassword(db, password);
    return securityStatus(db);
  });

  ipcMain.handle(IPC_CHANNELS.SECURITY_UNLOCK, async (_e, password: string) => {
    const ok = unlock(db, password || '');
    return { success: ok, ...securityStatus(db) };
  });

  ipcMain.handle(IPC_CHANNELS.SECURITY_LOCK, async () => {
    lock();
    return securityStatus(db);
  });
}

