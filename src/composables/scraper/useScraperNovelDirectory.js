import { ref, computed } from 'vue';

function safeResolveUrl(baseUrl, maybeUrl) {
  const raw = String(maybeUrl || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, baseUrl).toString();
  } catch (_) {
    return raw;
  }
}

function safeBuildRegex(pattern) {
  const s = String(pattern || '').trim();
  if (!s) return null;
  try {
    return new RegExp(s);
  } catch (_) {
    return null;
  }
}

function findNextDirectoryPageUrl(doc, pageUrl) {
  if (!doc) return '';
  try {
    const relNext = doc.querySelector('link[rel="next"], a[rel="next"]');
    if (relNext) {
      const href = relNext.getAttribute('href') || '';
      const u = safeResolveUrl(pageUrl, href);
      return u;
    }
  } catch (_) {
    // ignore
  }

  try {
    const links = Array.from(doc.querySelectorAll('a'));
    const next = links.find((a) => {
      const text = String(a.textContent || '').trim();
      if (!text) return false;
      return text.includes('下一页') || text.includes('下页') || text.includes('后页') || text === '下一章目录';
    });
    if (next) {
      const href = next.getAttribute('href') || '';
      const u = safeResolveUrl(pageUrl, href);
      return u;
    }
  } catch (_) {
    // ignore
  }

  return '';
}

export function useScraperNovelDirectory({
  invoke,
  buildRequestHeadersObject,
  requestTimeout,
  proxyUrl,
  acceptInvalidCerts,
  messageApi,
  enqueueUrls
}) {
  const directoryUrl = ref('');
  const linkSelector = ref('a');
  const linkAttr = ref('href');

  const sameDomainOnly = ref(true);
  const includePattern = ref('');
  const excludePattern = ref('');
  const maxItems = ref(5000);

  const parsing = ref(false);
  const parseError = ref('');
  const chapters = ref([]);

  const canParse = computed(() => {
    return !!String(directoryUrl.value || '').trim() && !!String(linkSelector.value || '').trim();
  });

  const parseDirectory = async () => {
    const url = String(directoryUrl.value || '').trim();
    const sel = String(linkSelector.value || '').trim();
    if (!url || !sel) {
      messageApi?.warning?.('请填写目录 URL 和选择器');
      return;
    }

    parsing.value = true;
    parseError.value = '';
    chapters.value = [];

    try {
      const base = new URL(url);
      const includeRe = safeBuildRegex(includePattern.value);
      const excludeRe = safeBuildRegex(excludePattern.value);

      const limit = Math.max(1, maxItems.value || 5000);
      const visitedPages = new Set();
      const seen = new Set();
      const deduped = [];

      // Safety: avoid infinite loops on directory pagination
      const maxDirectoryPages = 80;
      let pageUrl = url;
      let pageCount = 0;

      while (pageUrl && !visitedPages.has(pageUrl) && pageCount < maxDirectoryPages && deduped.length < limit) {
        visitedPages.add(pageUrl);
        pageCount += 1;

        const html = await invoke('fetch_url_decoded', {
          req: {
            url: pageUrl,
            headers: buildRequestHeadersObject(),
            timeoutMs: requestTimeout.value,
            proxyUrl: proxyUrl.value,
            acceptInvalidCerts: acceptInvalidCerts.value
          }
        });

        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');

        let nodes = [];
        try {
          nodes = Array.from(doc.querySelectorAll(sel));
        } catch (e) {
          throw new Error('选择器错误');
        }

        for (const el of nodes) {
          const href = linkAttr.value === 'text' ? (el.textContent || '') : (el.getAttribute(linkAttr.value) || '');
          const abs = safeResolveUrl(pageUrl, href);
          if (!abs) continue;

          let u;
          try {
            u = new URL(abs);
          } catch (_) {
            continue;
          }

          if (sameDomainOnly.value && u.hostname !== base.hostname) continue;

          const ustr = u.toString();
          if (includeRe && !includeRe.test(ustr)) continue;
          if (excludeRe && excludeRe.test(ustr)) continue;
          if (seen.has(ustr)) continue;

          seen.add(ustr);
          const title = String(el.textContent || '').trim().replace(/\s+/g, ' ');
          deduped.push({ url: ustr, title });

          if (deduped.length >= limit) break;
        }

        if (deduped.length >= limit) break;

        const nextPage = findNextDirectoryPageUrl(doc, pageUrl);
        if (!nextPage || nextPage === pageUrl) break;
        pageUrl = nextPage;
      }

      chapters.value = deduped;
      messageApi?.success?.(`解析完成：${deduped.length} 个章节链接`);
    } catch (e) {
      const msg = e && e.message ? String(e.message) : String(e);
      parseError.value = msg;
      messageApi?.error?.(`解析失败：${msg}`);
    } finally {
      parsing.value = false;
    }
  };

  const importToQueue = () => {
    const urls = (chapters.value || []).map((x) => x.url).filter(Boolean);
    if (!urls.length) {
      messageApi?.warning?.('没有可导入的章节链接');
      return;
    }
    enqueueUrls(urls);
    messageApi?.success?.(`已导入 ${urls.length} 个章节到队列`);
  };

  return {
    directoryUrl,
    linkSelector,
    linkAttr,
    sameDomainOnly,
    includePattern,
    excludePattern,
    maxItems,
    parsing,
    parseError,
    chapters,
    canParse,
    parseDirectory,
    importToQueue
  };
}
