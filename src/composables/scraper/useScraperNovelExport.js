import { computed, ref } from 'vue';
import { downloadFile } from './utils';

function stripHtmlToText(input) {
  const s = String(input ?? '');
  if (!s) return '';
  try {
    const div = document.createElement('div');
    div.innerHTML = s;
    return (div.textContent || div.innerText || '').trim();
  } catch (_) {
    return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function normalizeLineBreaks(s) {
  return String(s ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function useScraperNovelExport({
  crawlResults,
  fields,
  novelChapters,
  save,
  writeTextFile,
  messageApi
}) {
  const titleField = ref('title');
  const contentField = ref('content');
  const stripHtml = ref(true);
  const useDirectoryOrder = ref(true);
  const includeUrlLine = ref(false);

  const fieldOptions = computed(() => {
    return fields
      .filter((f) => f && f.name)
      .map((f) => ({ label: f.name, value: f.name }));
  });

  const orderIndexByUrl = computed(() => {
    const list = Array.isArray(novelChapters?.value) ? novelChapters.value : [];
    const map = new Map();
    list.forEach((c, idx) => {
      const u = String(c?.url || '').trim();
      if (!u) return;
      if (!map.has(u)) map.set(u, idx);
    });
    return map;
  });

  const sortedRows = computed(() => {
    const rows = Array.isArray(crawlResults.value) ? crawlResults.value.slice() : [];
    if (!useDirectoryOrder.value) {
      const withIndex = rows.some((r) => typeof r?.__chapterIndex === 'number');
      if (withIndex) {
        rows.sort((a, b) => (Number(a?.__chapterIndex ?? 0) - Number(b?.__chapterIndex ?? 0)));
      }
      return rows;
    }

    const map = orderIndexByUrl.value;
    if (!map || map.size === 0) {
      const withIndex = rows.some((r) => typeof r?.__chapterIndex === 'number');
      if (withIndex) {
        rows.sort((a, b) => (Number(a?.__chapterIndex ?? 0) - Number(b?.__chapterIndex ?? 0)));
      }
      return rows;
    }

    rows.sort((a, b) => {
      const au = String(a?.__url || '').trim();
      const bu = String(b?.__url || '').trim();
      const ai = map.has(au) ? map.get(au) : Number.MAX_SAFE_INTEGER;
      const bi = map.has(bu) ? map.get(bu) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return Number(a?.__chapterIndex ?? 0) - Number(b?.__chapterIndex ?? 0);
    });

    return rows;
  });

  const buildMergedText = (type) => {
    const rows = sortedRows.value;
    if (!rows.length) return '';

    const titleKey = String(titleField.value || '').trim();
    const contentKey = String(contentField.value || '').trim();

    const parts = [];

    for (const row of rows) {
      const t = titleKey ? row?.[titleKey] : '';
      const c = contentKey ? row?.[contentKey] : '';
      let title = String(t ?? '').trim();
      let content = String(c ?? '').trim();
      const url = String(row?.__url || '').trim();

      if (stripHtml.value) {
        title = stripHtmlToText(title);
        content = stripHtmlToText(content);
      }

      title = normalizeLineBreaks(title);
      content = normalizeLineBreaks(content);

      if (!title && !content) continue;

      if (type === 'md') {
        if (title) parts.push(`# ${title}`);
        if (includeUrlLine.value && url) parts.push(`> ${url}`);
        if (content) parts.push(content);
        parts.push('');
      } else {
        if (title) parts.push(title);
        if (includeUrlLine.value && url) parts.push(url);
        if (content) parts.push(content);
        parts.push('');
        parts.push('');
      }
    }

    return parts.join('\n').trim() + '\n';
  };

  const exportMerged = async (type) => {
    const ext = type === 'md' ? 'md' : 'txt';
    const content = buildMergedText(type);
    if (!content) {
      messageApi?.warning?.('暂无可导出的内容');
      return;
    }

    try {
      const filePath = await save({
        defaultPath: `novel.${ext}`,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
      });
      if (!filePath) return;
      await writeTextFile(filePath, content);
      messageApi?.success?.('导出成功');
    } catch (_) {
      try {
        downloadFile(`novel.${ext}`, content, 'text/plain');
        messageApi?.info?.('已使用浏览器下载方式导出');
      } catch (_) {
        messageApi?.error?.('导出失败');
      }
    }
  };

  return {
    titleField,
    contentField,
    stripHtml,
    useDirectoryOrder,
    includeUrlLine,
    fieldOptions,
    exportMerged
  };
}
