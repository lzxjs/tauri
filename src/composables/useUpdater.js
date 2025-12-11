import { ref } from 'vue';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { message, Modal } from 'ant-design-vue';

export function useUpdater() {
  const checking = ref(false);
  const downloading = ref(false);

  const checkForUpdates = async (silent = false) => {
    if (checking.value) return;

    checking.value = true;
    try {
      const update = await check();

      if (update) {
        Modal.confirm({
          title: '发现新版本',
          content: `当前版本：${update.currentVersion}\n最新版本：${update.version}\n\n${update.body || ''}`,
          okText: '立即更新',
          cancelText: '稍后提醒',
          onOk: async () => {
            downloading.value = true;
            try {
              await update.downloadAndInstall();
              await relaunch();
            } catch (error) {
              message.error('更新失败：' + error);
              downloading.value = false;
            }
          }
        });
      } else if (!silent) {
        message.success('当前已是最新版本');
      }
    } catch (error) {
      if (!silent) {
        message.error('检查更新失败：' + error);
      }
    } finally {
      checking.value = false;
    }
  };

  return {
    checking,
    downloading,
    checkForUpdates
  };
}
