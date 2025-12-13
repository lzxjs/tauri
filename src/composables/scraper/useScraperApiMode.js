import { ref, computed } from 'vue';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

function headersArrayToObject(list) {
  const headers = {};
  (list || []).forEach((h) => {
    if (!h) return;
    const k = String(h.key || '').trim();
    if (!k) return;
    headers[k] = String(h.value ?? '');
  });
  return headers;
}

function parsePathTokens(path) {
  const s = String(path || '').trim();
  if (!s) return [];
  if (s === '$') return [];

  const tokens = [];
  const parts = s.split('.').filter(Boolean);
  for (const part of parts) {
    const re = /([^\[]+)(\[(\d+)\])*/g;
    let m;
    while ((m = re.exec(part))) {
      const key = m[1];
      if (key) tokens.push(key);
      const idxRe = /\[(\d+)\]/g;
      let im;
      while ((im = idxRe.exec(m[0]))) {
        tokens.push(Number(im[1]));
      }
    }
  }
  return tokens;
}

function getByPath(obj, path) {
  const tokens = parsePathTokens(path);
  let cur = obj;
  for (const t of tokens) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof t === 'number') {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[t];
      continue;
    }
    if (typeof cur !== 'object') return undefined;
    cur = cur[t];
  }
  return cur;
}

export function useScraperApiMode({ apiMode, messageApi }) {
  const loading = ref(false);
  const responseStatus = ref(null);
  const responseStatusText = ref('');
  const responseText = ref('');
  const responseError = ref('');
  const responseTimeMs = ref(0);

  const parsedJson = computed(() => {
    const t = String(responseText.value || '');
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch (_) {
      return null;
    }
  });

  const extracted = computed(() => {
    const root = parsedJson.value;
    if (root === null || root === undefined) return null;

    const cfg = apiMode.value || {};
    const dataPath = String(cfg.dataPath || '').trim();
    const dataNode = dataPath ? getByPath(root, dataPath) : root;

    const mappings = Array.isArray(cfg.extract) ? cfg.extract : [];

    const mapOne = (item) => {
      if (!mappings.length) return item;
      const row = {};
      mappings.forEach((m) => {
        const name = String(m?.name || '').trim();
        const path = String(m?.path || '').trim();
        if (!name || !path) return;
        row[name] = getByPath(item, path);
      });
      return row;
    };

    if (Array.isArray(dataNode)) {
      return dataNode.map((it) => mapOne(it));
    }
    if (dataNode && typeof dataNode === 'object') {
      return mapOne(dataNode);
    }
    return dataNode;
  });

  const extractedJson = computed(() => {
    return JSON.stringify(extracted.value, null, 2);
  });

  const hasExtracted = computed(() => {
    const v = extracted.value;
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined;
  });

  const runRequest = async () => {
    const cfg = apiMode.value || {};
    const url = String(cfg.url || '').trim();
    if (!url) {
      messageApi?.warning?.('请输入接口 URL');
      return;
    }

    loading.value = true;
    responseError.value = '';
    responseStatus.value = null;
    responseStatusText.value = '';
    responseText.value = '';

    const start = Date.now();
    try {
      const method = String(cfg.method || 'GET').toUpperCase();
      const headers = headersArrayToObject(cfg.headers);

      const init = { method, headers };
      if (method !== 'GET' && method !== 'HEAD') {
        const body = String(cfg.body || '');
        if (body) init.body = body;
      }

      const resp = await tauriFetch(url, init);
      responseStatus.value = resp.status;
      responseStatusText.value = resp.statusText || '';

      const text = await resp.text();
      responseText.value = text;
    } catch (e) {
      responseError.value = e && e.message ? String(e.message) : String(e);
      messageApi?.error?.('请求失败');
    } finally {
      responseTimeMs.value = Date.now() - start;
      loading.value = false;
    }
  };

  const addApiHeader = () => {
    if (!apiMode.value.headers) apiMode.value.headers = [];
    apiMode.value.headers.push({ key: '', value: '' });
  };

  const removeApiHeader = (index) => {
    if (!Array.isArray(apiMode.value.headers)) return;
    apiMode.value.headers.splice(index, 1);
  };

  const addExtractField = () => {
    if (!apiMode.value.extract) apiMode.value.extract = [];
    apiMode.value.extract.push({ name: '', path: '' });
  };

  const removeExtractField = (index) => {
    if (!Array.isArray(apiMode.value.extract)) return;
    apiMode.value.extract.splice(index, 1);
  };

  return {
    loading,
    responseStatus,
    responseStatusText,
    responseText,
    responseError,
    responseTimeMs,
    parsedJson,
    extracted,
    extractedJson,
    hasExtracted,
    runRequest,
    addApiHeader,
    removeApiHeader,
    addExtractField,
    removeExtractField
  };
}
