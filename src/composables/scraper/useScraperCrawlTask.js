import { computed } from 'vue';
import { buildHeadersObject, downloadFile, normalizedUrl, safeResolveUrl, sleep, toCsv } from './utils';

export function useScraperCrawlTask({
  targetUrl,
  startUrlsText,
  crawlQueue,
  crawlResults,
  crawlRunning,
  crawlProcessed,
  crawlMaxPages,
  crawlConcurrency,
  crawlDelayMs,
  crawlRetry,
  discoverLinksSelector,
  discoverLinksAttr,
  discoverLinksCustomAttr,
  nextPageSelector,
  nextPageAttr,
  nextPageCustomAttr,
  crawlRunId,
  crawlPaused,
  crawlActiveUrls,
  crawlFailures,
  crawlLogs,
  crawlDedupEnabled,
  crawlDedupKey,
  crawlClearOnStart,
  fields,
  listMode,
  listSelector,
  requestHeaders,
  requestTimeout,
  proxyUrl,
  acceptInvalidCerts,
  invoke,
  save,
  writeTextFile,
  extractValue,
  messageApi
}) {
  let chapterIndexCounter = 0;

  const pushCrawlLog = (text) => {
    const line = `[${new Date().toLocaleTimeString()}] ${text}`;
    crawlLogs.value.push(line);
    if (crawlLogs.value.length > 500) crawlLogs.value.splice(0, crawlLogs.value.length - 500);
  };

  const clearCrawlLogs = () => {
    crawlLogs.value = [];
  };

  const clearCrawlFailures = () => {
    crawlFailures.value = [];
  };

  const exportCrawlFailures = () => {
    if (!crawlFailures.value.length) return;
    downloadFile('crawl-failures.json', JSON.stringify(crawlFailures.value, null, 2));
  };

  const crawlFailureColumns = computed(() => {
    return [
      { title: '时间', dataIndex: 'time', key: 'time', width: 110 },
      { title: 'URL', dataIndex: 'url', key: 'url' },
      { title: '错误', dataIndex: 'error', key: 'error' }
    ];
  });

  const crawlQueuePreview = computed(() => {
    return (crawlQueue.value || []).slice(0, 30);
  });

  const crawlDedupKeyOptions = computed(() => {
    const opts = [{ label: '__url', value: '__url' }];
    fields.filter((f) => f && f.name).forEach((f) => {
      opts.push({ label: f.name, value: f.name });
    });
    return opts;
  });

  const parseStartUrls = () => {
    const text = (startUrlsText.value || '').trim();
    const list = text
      ? text
          .split(/\r?\n/)
          .map((x) => normalizedUrl(x))
          .filter(Boolean)
      : (targetUrl.value ? [normalizedUrl(targetUrl.value)] : []);
    return Array.from(new Set(list));
  };

  const enqueueUrls = (urls) => {
    const set = new Set(crawlQueue.value);
    (urls || []).forEach((u) => {
      const nu = normalizedUrl(u);
      if (!nu) return;
      if (!set.has(nu)) {
        set.add(nu);
        crawlQueue.value.push(nu);
      }
    });
  };

  const useCurrentUrlAsStart = () => {
    const u = normalizedUrl(targetUrl.value);
    if (!u) return;
    const current = (startUrlsText.value || '').trim();
    startUrlsText.value = current ? `${current}\n${u}` : u;
  };

  const importStartUrlsToQueue = () => {
    const urls = parseStartUrls();
    if (!urls.length) {
      messageApi?.warning?.('没有可导入的 URL');
      return;
    }
    enqueueUrls(urls);
    messageApi?.success?.(`已导入 ${urls.length} 个 URL 到队列`);
  };

  const clearCrawlQueue = () => {
    crawlQueue.value = [];
  };

  const clearCrawlResults = () => {
    crawlResults.value = [];
    crawlProcessed.value = 0;
    chapterIndexCounter = 0;
  };

  const togglePauseCrawl = () => {
    if (!crawlRunning.value) return;
    crawlPaused.value = !crawlPaused.value;
    pushCrawlLog(crawlPaused.value ? '任务已暂停' : '任务已继续');
  };

  const stopCrawl = () => {
    crawlRunning.value = false;
    crawlPaused.value = false;
    crawlActiveUrls.value = [];
    crawlRunId.value += 1;
  };

  const getAttrValue = (el, attr, customAttr) => {
    if (!el) return '';
    if (attr === 'custom') return el.getAttribute(customAttr || '');
    return el.getAttribute(attr);
  };

  const extractFromDocForTask = (doc, pageUrl) => {
    if (!doc) return [];
    const results = [];
    if (listMode.value && listSelector.value) {
      const items = Array.from(doc.querySelectorAll(listSelector.value));
      items.forEach((item, idx) => {
        const row = { __url: pageUrl, __index: idx + 1 };
        fields.forEach((field) => {
          if (field.name && field.selector) {
            const el = item.querySelector(field.selector);
            row[field.name] = extractValue(el, field, pageUrl);
          }
        });
        results.push(row);
      });
      return results;
    }

    const row = { __url: pageUrl, __index: 1 };
    fields.forEach((field) => {
      if (field.name && field.selector) {
        const el = doc.querySelector(field.selector);
        row[field.name] = extractValue(el, field, pageUrl);
      }
    });
    results.push(row);
    return results;
  };

  const discoverUrlsFromDoc = (doc, pageUrl) => {
    const sel = (discoverLinksSelector.value || '').trim();
    if (!sel) return [];
    try {
      const nodes = Array.from(doc.querySelectorAll(sel));
      const urls = nodes
        .map((el) => getAttrValue(el, discoverLinksAttr.value, discoverLinksCustomAttr.value))
        .filter(Boolean)
        .map((u) => safeResolveUrl(pageUrl, u));
      return Array.from(new Set(urls));
    } catch (_) {
      return [];
    }
  };

  const getNextPageUrlFromDoc = (doc, pageUrl) => {
    const sel = (nextPageSelector.value || '').trim();
    if (!sel) {
      try {
        const links = Array.from(doc.querySelectorAll('a'));
        const preferred = links.find((a) => {
          const text = (a.textContent || '').trim();
          if (!text) return false;
          return text.includes('下一章') || text.includes('下章') || text.includes('下一页') || text.includes('下页');
        });
        const href = preferred ? preferred.getAttribute('href') : '';
        return href ? safeResolveUrl(pageUrl, href) : '';
      } catch (_) {
        return '';
      }
    }

    try {
      const el = doc.querySelector(sel);
      const raw = getAttrValue(el, nextPageAttr.value, nextPageCustomAttr.value);
      return raw ? safeResolveUrl(pageUrl, raw) : '';
    } catch (_) {
      return '';
    }
  };

  const fetchHtmlForTask = async (url) => {
    const html = await invoke('fetch_url_decoded', {
      req: {
        url,
        headers: buildHeadersObject(requestHeaders.value),
        timeoutMs: requestTimeout.value,
        proxyUrl: proxyUrl.value,
        acceptInvalidCerts: acceptInvalidCerts.value
      }
    });
    return String(html || '');
  };

  const crawlTableColumns = computed(() => {
    const cols = [
      { title: '__url', dataIndex: '__url', key: '__url' },
      { title: '__chapterIndex', dataIndex: '__chapterIndex', key: '__chapterIndex', width: 110 },
      { title: '__index', dataIndex: '__index', key: '__index', width: 80 }
    ];
    fields
      .filter((f) => f && f.name)
      .forEach((f) => {
        cols.push({ title: f.name, dataIndex: f.name, key: f.name });
      });
    return cols;
  });

  const exportCrawlData = (type) => {
    if (!crawlResults.value || crawlResults.value.length === 0) return;

    (async () => {
      try {
        const ext = type === 'csv' ? 'csv' : 'json';
        const filePath = await save({
          defaultPath: `crawl-data.${ext}`,
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
        });
        if (!filePath) return;

        if (type === 'json') {
          await writeTextFile(filePath, JSON.stringify(crawlResults.value, null, 2));
          messageApi?.success?.('导出成功');
          return;
        }

        const csvContent = toCsv(crawlResults.value);
        await writeTextFile(filePath, csvContent);
        messageApi?.success?.('导出成功');
      } catch (_) {
        try {
          if (type === 'json') {
            downloadFile('crawl-data.json', JSON.stringify(crawlResults.value, null, 2));
            messageApi?.info?.('已使用浏览器下载方式导出');
            return;
          }
          const csvContent = toCsv(crawlResults.value);
          downloadFile('crawl-data.csv', csvContent, 'text/csv');
          messageApi?.info?.('已使用浏览器下载方式导出');
        } catch (_) {
          messageApi?.error?.('导出失败');
        }
      }
    })();
  };

  const startCrawl = async () => {
    if (crawlRunning.value) return;
    const runId = crawlRunId.value + 1;
    crawlRunId.value = runId;

    chapterIndexCounter = 0;

    if (crawlClearOnStart.value) {
      clearCrawlResults();
      clearCrawlFailures();
      clearCrawlLogs();
    }

    crawlPaused.value = false;

    const starters = parseStartUrls();
    enqueueUrls(starters);

    if (crawlQueue.value.length === 0) {
      messageApi?.warning?.('队列为空');
      return;
    }

    crawlRunning.value = true;
    const visited = new Set();
    const dedupSet = new Set();
    pushCrawlLog(`开始任务：并发=${crawlConcurrency.value} 间隔=${crawlDelayMs.value}ms 最大页数=${crawlMaxPages.value}`);

    const worker = async () => {
      while (crawlRunning.value && crawlRunId.value === runId) {
        if (crawlProcessed.value >= crawlMaxPages.value) break;

        while (crawlPaused.value && crawlRunning.value && crawlRunId.value === runId) {
          await sleep(150);
        }

        const url = crawlQueue.value.shift();
        if (!url) break;
        if (visited.has(url)) continue;
        visited.add(url);

        chapterIndexCounter += 1;
        const chapterIndex = chapterIndexCounter;

        crawlActiveUrls.value = Array.from(new Set([...(crawlActiveUrls.value || []), url]));
        pushCrawlLog(`抓取: ${url}`);

        let attempt = 0;
        while (crawlRunning.value && crawlRunId.value === runId) {
          try {
            const html = await fetchHtmlForTask(url);
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const rows = extractFromDocForTask(doc, url);
            rows.forEach((r, idx) => {
              if (crawlDedupEnabled.value) {
                const keyName = crawlDedupKey.value || '__url';
                const keyVal = keyName === '__url' ? url : (r?.[keyName] ?? '');
                const dedupKeyVal = String(keyVal ?? '');
                if (dedupKeyVal && dedupSet.has(dedupKeyVal)) return;
                if (dedupKeyVal) dedupSet.add(dedupKeyVal);
              }
              crawlResults.value.push({ __rowKey: `${url}__${idx}__${Date.now()}`, __chapterIndex: chapterIndex, ...r });
            });

            if (rows.length) pushCrawlLog(`提取结果: ${rows.length} 条`);

            const discovered = discoverUrlsFromDoc(doc, url);
            if (discovered.length) {
              enqueueUrls(discovered);
              pushCrawlLog(`发现链接: +${discovered.length}`);
            }

            const nextUrl = getNextPageUrlFromDoc(doc, url);
            if (nextUrl) {
              enqueueUrls([nextUrl]);
              pushCrawlLog(`发现下一页: ${nextUrl}`);
            }

            crawlProcessed.value += 1;
            break;
          } catch (e) {
            attempt += 1;
            if (attempt > (crawlRetry.value || 0)) {
              crawlFailures.value.push({
                id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                time: new Date().toLocaleTimeString(),
                url,
                error: e && e.message ? String(e.message) : String(e)
              });
              pushCrawlLog(`失败: ${url}`);
              crawlProcessed.value += 1;
              break;
            }
            await sleep(200);
          }
        }

        crawlActiveUrls.value = (crawlActiveUrls.value || []).filter((x) => x !== url);

        await sleep(crawlDelayMs.value);
      }
    };

    try {
      const n = Math.max(1, Math.min(8, crawlConcurrency.value || 1));
      await Promise.all(Array.from({ length: n }, () => worker()));
    } finally {
      if (crawlRunId.value === runId) {
        crawlRunning.value = false;
        crawlPaused.value = false;
        crawlActiveUrls.value = [];
        pushCrawlLog('任务结束');
      }
    }
  };

  return {
    pushCrawlLog,
    clearCrawlLogs,
    clearCrawlFailures,
    exportCrawlFailures,
    exportCrawlData,
    crawlFailureColumns,
    crawlQueuePreview,
    crawlDedupKeyOptions,
    crawlTableColumns,
    parseStartUrls,
    enqueueUrls,
    useCurrentUrlAsStart,
    importStartUrlsToQueue,
    clearCrawlQueue,
    clearCrawlResults,
    togglePauseCrawl,
    stopCrawl,
    startCrawl
  };
}
