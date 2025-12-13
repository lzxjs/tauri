import { ref, computed, watch } from 'vue';
import { downloadFile, safeResolveUrl, toCsv } from './utils';

export function useScraperPreview({
  rawHtml,
  processedHtml,
  targetUrl,
  fields,
  listMode,
  listSelector,
  messageApi
}) {
  const previewResult = ref([]);

  const cachedDocHtml = ref('');
  const cachedDoc = ref(null);
  const getParsedDoc = () => {
    const html = rawHtml?.value || '';
    if (!html) return null;
    if (cachedDoc.value && cachedDocHtml.value === html) return cachedDoc.value;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    cachedDoc.value = doc;
    cachedDocHtml.value = html;
    return doc;
  };

  const extractValue = (el, field, baseUrl) => {
    if (!el) return null;
    let val = '';
    switch (field.attr) {
      case 'text':
        val = el.textContent.trim();
        break;
      case 'html':
        val = el.innerHTML;
        break;
      case 'href':
        val = el.getAttribute('href');
        break;
      case 'src':
        val = el.getAttribute('src');
        break;
      case 'custom':
        val = el.getAttribute(field.customAttr);
        break;
      default:
        val = el.textContent.trim();
    }

    if ((field.attr === 'href' || field.attr === 'src') && typeof val === 'string') {
      val = safeResolveUrl(baseUrl, val);
    }

    if (val && field.transformType === 'regex' && field.transformPattern) {
      try {
        const re = new RegExp(field.transformPattern);
        const match = val.match(re);
        if (match) val = match[1] || match[0];
      } catch (e) {
        console.warn('Regex Error', e);
      }
    } else if (val && field.transformType === 'replace' && field.transformPattern) {
      try {
        val = val.replace(new RegExp(field.transformPattern, 'g'), field.transformReplacement || '');
      } catch (e) {
        console.warn('Replace Error', e);
      }
    } else if (val && field.transformType === 'trim') {
      val = val.trim();
    }

    return val;
  };

  const refreshPreview = () => {
    if (!rawHtml?.value) return;

    const doc = getParsedDoc();
    if (!doc) return;

    if (listMode.value && listSelector.value) {
      const items = doc.querySelectorAll(listSelector.value);
      const results = [];
      items.forEach((item) => {
        const row = {};
        fields.forEach((field) => {
          if (field.name && field.selector) {
            const el = item.querySelector(field.selector);
            row[field.name] = extractValue(el, field, targetUrl.value);
          }
        });
        results.push(row);
      });
      previewResult.value = results;
      return;
    }

    const row = {};
    fields.forEach((field) => {
      if (field.name && field.selector) {
        const el = doc.querySelector(field.selector);
        row[field.name] = extractValue(el, field, targetUrl.value);
      }
    });
    previewResult.value = row;
  };

  const refreshTimer = ref(null);
  const scheduleRefreshPreview = () => {
    if (refreshTimer.value) clearTimeout(refreshTimer.value);
    refreshTimer.value = setTimeout(() => {
      refreshPreview();
    }, 250);
  };

  const hasPreviewData = computed(() => {
    if (listMode.value) {
      return Array.isArray(previewResult.value) && previewResult.value.length > 0;
    }
    return (
      previewResult.value &&
      typeof previewResult.value === 'object' &&
      Object.keys(previewResult.value).length > 0
    );
  });

  const previewCountText = computed(() => {
    if (!processedHtml?.value) return 'Ready';
    if (listMode.value) {
      const n = Array.isArray(previewResult.value) ? previewResult.value.length : 0;
      return `${n} 条结果`;
    }
    return hasPreviewData.value ? '1 条结果' : '0 条结果';
  });

  const previewDataJson = computed(() => {
    return JSON.stringify(previewResult.value, null, 2);
  });

  const fieldSampleText = (fieldName) => {
    if (!fieldName) return '—';
    if (!hasPreviewData.value) return '—';
    const row = listMode.value
      ? (Array.isArray(previewResult.value) ? previewResult.value[0] : null)
      : previewResult.value;
    const val = row ? row[fieldName] : null;
    if (val === null || val === undefined || val === '') return '—';
    const str = String(val);
    return str.length > 80 ? `${str.slice(0, 80)}…` : str;
  };

  const copyPreviewData = async () => {
    if (!hasPreviewData.value) return;
    try {
      await navigator.clipboard.writeText(previewDataJson.value);
      messageApi?.success?.('已复制预览数据');
    } catch (_) {
      messageApi?.error?.('复制失败');
    }
  };

  const exportData = (type) => {
    if (!previewResult.value) return;

    if (type === 'json') {
      downloadFile('data.json', JSON.stringify(previewResult.value, null, 2));
      return;
    }

    if (type === 'csv') {
      const csvContent = toCsv(previewResult.value);
      if (!csvContent) return;
      downloadFile('data.csv', csvContent, 'text/csv');
    }
  };

  const detectListSelector = () => {
    if (!rawHtml?.value) {
      messageApi?.warning?.('请先加载页面');
      return;
    }

    try {
      const doc = getParsedDoc();
      if (!doc) {
        messageApi?.error?.('页面解析失败');
        return;
      }
      const body = doc.body;
      if (!body) {
        messageApi?.error?.('页面解析失败');
        return;
      }

      let best = null;
      const parents = body.querySelectorAll('*');
      parents.forEach((parent) => {
        const children = Array.from(parent.children || []);
        if (children.length < 6) return;

        const counter = new Map();
        children.forEach((ch) => {
          const tag = ch.tagName ? ch.tagName.toLowerCase() : '';
          if (!tag) return;
          const cls = (ch.getAttribute('class') || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
          const key = cls.length ? `.${cls[0]}` : tag;
          counter.set(key, (counter.get(key) || 0) + 1);
        });

        for (const [key, count] of counter.entries()) {
          if (count < 3) continue;
          const score = count;
          if (!best || score > best.score) {
            best = { selector: key, score };
          }
        }
      });

      if (!best) {
        messageApi?.info?.('未检测到明显的列表结构，请手动输入');
        return;
      }

      listSelector.value = best.selector;
      messageApi?.success?.(`已智能填入: ${best.selector}`);
      scheduleRefreshPreview();
    } catch (_) {
      messageApi?.error?.('智能检测失败，请手动输入');
    }
  };

  const fieldDiagnostics = computed(() => {
    const doc = getParsedDoc();
    if (!doc) {
      return fields.map((f) => ({ state: f?.selector ? 'unknown' : 'empty' }));
    }

    return fields.map((f) => {
      const sel = String(f?.selector || '').trim();
      if (!sel) return { state: 'empty' };

      if (listMode.value) {
        const listSel = String(listSelector.value || '').trim();
        if (!listSel) return { state: 'needList' };
        let sampleItems = [];
        try {
          sampleItems = Array.from(doc.querySelectorAll(listSel)).slice(0, 10);
        } catch (_) {
          return { state: 'invalid' };
        }
        if (sampleItems.length === 0) return { state: 'noListItems' };

        try {
          let hitItems = 0;
          let totalMatches = 0;
          for (const item of sampleItems) {
            const c = item.querySelectorAll(sel).length;
            if (c > 0) hitItems += 1;
            totalMatches += c;
          }
          const avg = totalMatches / sampleItems.length;
          if (hitItems === 0) return { state: 'zero', count: 0, hitItems, sample: sampleItems.length, avg };
          if (hitItems < sampleItems.length) {
            return { state: 'partial', count: totalMatches, hitItems, sample: sampleItems.length, avg };
          }
          if (avg > 1.01) return { state: 'multi', count: totalMatches, hitItems, sample: sampleItems.length, avg };
          return { state: 'ok', count: totalMatches, hitItems, sample: sampleItems.length, avg };
        } catch (_) {
          return { state: 'invalid' };
        }
      }

      try {
        const count = doc.querySelectorAll(sel).length;
        if (count === 0) return { state: 'zero', count };
        if (count === 1) return { state: 'ok', count };
        return { state: 'multi', count };
      } catch (_) {
        return { state: 'invalid' };
      }
    });
  });

  const fieldDiagnosticText = (index) => {
    const d = fieldDiagnostics.value?.[index];
    if (!d) return '—';
    if (d.state === 'empty') return '未设置';
    if (d.state === 'invalid') return '选择器错误';
    if (d.state === 'needList') return '需列表选择器';
    if (d.state === 'noListItems') return '列表为空';
    if (!listMode.value) {
      if (d.state === 'ok') return 'OK';
      if (d.state === 'zero') return '0 命中';
      if (d.state === 'multi') return `${d.count} 命中`;
      return '—';
    }
    if (d.state === 'ok') return `${d.hitItems}/${d.sample}`;
    if (d.state === 'partial') return `${d.hitItems}/${d.sample}`;
    if (d.state === 'zero') return '0 命中';
    if (d.state === 'multi') return `多(${d.hitItems}/${d.sample})`;
    return '—';
  };

  const fieldDiagnosticColor = (index) => {
    const d = fieldDiagnostics.value?.[index];
    if (!d) return 'default';
    if (d.state === 'ok') return 'green';
    if (d.state === 'partial') return 'gold';
    if (d.state === 'multi') return 'orange';
    if (d.state === 'zero') return 'red';
    if (d.state === 'invalid') return 'red';
    return 'default';
  };

  watch([fields, listMode, listSelector], () => {
    scheduleRefreshPreview();
  }, { deep: true });

  const disposePreview = () => {
    if (refreshTimer.value) {
      clearTimeout(refreshTimer.value);
      refreshTimer.value = null;
    }
  };

  return {
    previewResult,
    hasPreviewData,
    previewCountText,
    previewDataJson,
    fieldSampleText,
    refreshPreview,
    scheduleRefreshPreview,
    copyPreviewData,
    exportData,
    detectListSelector,
    getParsedDoc,
    extractValue,
    fieldDiagnostics,
    fieldDiagnosticText,
    fieldDiagnosticColor,
    disposePreview
  };
}
