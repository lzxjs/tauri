/**
 * 全局网络流量统计服务
 * 在应用启动时自动开始统计，不受页面切换影响
 */

import { invoke } from "@tauri-apps/api/core";
import { ref } from "vue";

// localStorage 键名
const STORAGE_KEY_TRAFFIC = "system_seven_day_traffic";
const STORAGE_KEY_LAST_NETWORK = "system_last_network_data";

// 上一次的网络数据，用于计算增量
let lastNetworkData = null;

// 七日网络流量统计（响应式数据，供组件使用）
export const sevenDayTraffic = ref({});

// 当前网络速度（字节/秒）
export const currentNetworkSpeed = ref({ upload: 0, download: 0 });

// 定时器
let statsTimer = null;

// 获取指定天数前的日期字符串
const getDateString = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toDateString();
};

// 从 localStorage 加载七日流量数据和基准网络数据
const loadTrafficData = () => {
  try {
    // 加载七日流量数据
    const storedTraffic = localStorage.getItem(STORAGE_KEY_TRAFFIC);
    if (storedTraffic) {
      const data = JSON.parse(storedTraffic);

      // 清理超过7天的数据
      const cleanedData = {};
      const now = new Date();

      Object.keys(data).forEach(dateKey => {
        const date = new Date(dateKey);
        const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (daysDiff < 7) {
          cleanedData[dateKey] = data[dateKey];
        }
      });

      sevenDayTraffic.value = cleanedData;
    }

    // 加载上次的网络基准数据
    const storedLastNetwork = localStorage.getItem(STORAGE_KEY_LAST_NETWORK);
    if (storedLastNetwork) {
      lastNetworkData = JSON.parse(storedLastNetwork);
    }

    console.log("[NetworkTrafficService] 数据加载完成");
  } catch (error) {
    console.error("[NetworkTrafficService] 加载数据失败:", error);
  }
};

// 保存七日流量数据和基准网络数据到 localStorage
const saveTrafficData = () => {
  try {
    localStorage.setItem(STORAGE_KEY_TRAFFIC, JSON.stringify(sevenDayTraffic.value));
    localStorage.setItem(STORAGE_KEY_LAST_NETWORK, JSON.stringify(lastNetworkData));
  } catch (error) {
    console.error("[NetworkTrafficService] 保存数据失败:", error);
  }
};

// 统计网络流量
const collectNetworkStats = async () => {
  try {
    const network = await invoke("get_network_info");

    // 计算网络速度和累计流量
    if (lastNetworkData && network.length > 0) {
      let totalUpload = 0;
      let totalDownload = 0;

      network.forEach((iface, index) => {
        const lastIface = lastNetworkData[index];
        if (lastIface && lastIface.interface_name === iface.interface_name) {
          totalDownload += iface.received_bytes - lastIface.received_bytes;
          totalUpload += iface.transmitted_bytes - lastIface.transmitted_bytes;
        }
      });

      // 更新当前速度
      currentNetworkSpeed.value = {
        upload: totalUpload,
        download: totalDownload,
      };

      // 累加到今日流量统计
      const today = getDateString(0);
      if (!sevenDayTraffic.value[today]) {
        sevenDayTraffic.value[today] = { upload: 0, download: 0 };
      }
      sevenDayTraffic.value[today].upload += totalUpload;
      sevenDayTraffic.value[today].download += totalDownload;

      // 保存数据
      saveTrafficData();
    }

    // 更新基准网络数据
    lastNetworkData = network;

    // 如果是第一次获取数据，也要保存基准
    if (!statsTimer) {
      saveTrafficData();
    }
  } catch (error) {
    console.error("[NetworkTrafficService] 统计失败:", error);
  }
};

/**
 * 启动网络流量统计服务
 * 在应用启动时调用一次即可
 */
export const startNetworkTrafficService = async () => {
  if (statsTimer) {
    console.warn("[NetworkTrafficService] 服务已在运行");
    return;
  }

  console.log("[NetworkTrafficService] 启动服务");

  // 加载历史数据
  loadTrafficData();

  // 首次采集（作为基准）
  await collectNetworkStats();

  // 每秒采集一次
  statsTimer = setInterval(collectNetworkStats, 1000);
};

/**
 * 停止网络流量统计服务
 * 通常在应用关闭时调用
 */
export const stopNetworkTrafficService = () => {
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
    console.log("[NetworkTrafficService] 服务已停止");
  }
};

/**
 * 获取指定日期的流量数据
 * @param {number} daysAgo - 几天前（0=今天，1=昨天，...）
 * @returns {{upload: number, download: number}}
 */
export const getTrafficByDate = (daysAgo) => {
  const dateKey = getDateString(daysAgo);
  return sevenDayTraffic.value[dateKey] || { upload: 0, download: 0 };
};

/**
 * 清空所有流量统计数据
 */
export const clearAllTrafficData = () => {
  sevenDayTraffic.value = {};
  lastNetworkData = null;
  currentNetworkSpeed.value = { upload: 0, download: 0 };
  localStorage.removeItem(STORAGE_KEY_TRAFFIC);
  localStorage.removeItem(STORAGE_KEY_LAST_NETWORK);
  console.log("[NetworkTrafficService] 所有数据已清空");
};
