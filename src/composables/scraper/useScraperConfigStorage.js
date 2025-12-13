import { ref, computed, watch } from 'vue';
import { downloadFile, normalizedUrl } from './utils';

export function useScraperConfigStorage({
  targetUrl,
  requestMethod,
  fields,
  listMode,
  listSelector,
  requestHeaders,
  requestTimeout,
  proxyUrl,
  acceptInvalidCerts,
  autoExitOnPick,
  autoAdvanceOnPick,
  startUrlsText,
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
  crawlDedupEnabled,
  crawlDedupKey,
  crawlClearOnStart,
  apiMode,
  onConfigApplied,
  messageApi
}) {
  const urlHistory = ref([]);
  const URL_HISTORY_KEY = 'scraper:urlHistory:v1';
  const MAX_URL_HISTORY = 20;

  const templates = ref([]);
  const templateModalVisible = ref(false);
  const templateModalMode = ref('save');
  const templateNameInput = ref('');
  const selectedTemplateId = ref('');
  const TEMPLATES_KEY = 'scraper:templates:v1';

  const LAST_CONFIG_KEY = 'scraper:lastConfig:v2';
  const autosaveTimer = ref(null);

  const fileInput = ref(null);

  const cloneFields = () => {
    try {
      return JSON.parse(JSON.stringify(fields));
    } catch (_) {
      return fields.map((f) => ({ ...f }));
    }
  };

  const normalizeFields = (arr) => {
    const list = Array.isArray(arr) ? arr : [];
    return list.map((f, idx) => ({
      name: typeof f?.name === 'string' ? f.name : `field_${idx + 1}`,
      selector: typeof f?.selector === 'string' ? f.selector : '',
      attr: typeof f?.attr === 'string' ? f.attr : 'text',
      customAttr: typeof f?.customAttr === 'string' ? f.customAttr : '',
      transformType: typeof f?.transformType === 'string' ? f.transformType : 'none',
      transformPattern: typeof f?.transformPattern === 'string' ? f.transformPattern : '',
      transformReplacement: typeof f?.transformReplacement === 'string' ? f.transformReplacement : ''
    }));
  };

  const cloneHeaders = () => {
    const list = Array.isArray(requestHeaders.value) ? requestHeaders.value : [];
    return list.map((h) => ({
      key: typeof h?.key === 'string' ? h.key : '',
      value: typeof h?.value === 'string' ? h.value : ''
    }));
  };

  const getApiModeSnapshot = () => {
    const m = apiMode?.value && typeof apiMode.value === 'object' ? apiMode.value : {};
    return {
      enabled: !!m.enabled,
      method: typeof m.method === 'string' ? m.method : 'GET',
      url: typeof m.url === 'string' ? m.url : '',
      dataPath: typeof m.dataPath === 'string' ? m.dataPath : '',
      headers: Array.isArray(m.headers) ? m.headers : [],
      body: typeof m.body === 'string' ? m.body : '',
      extract: Array.isArray(m.extract) ? m.extract : [],
      pagination: m.pagination && typeof m.pagination === 'object' ? m.pagination : { type: 'none' }
    };
  };

  const applyApiModeSnapshot = (snapshot) => {
    if (!apiMode) return;
    if (!apiMode.value || typeof apiMode.value !== 'object') apiMode.value = {};
    const s = snapshot && typeof snapshot === 'object' ? snapshot : {};
    apiMode.value.enabled = !!s.enabled;
    if (typeof s.method === 'string') apiMode.value.method = s.method;
    if (typeof s.url === 'string') apiMode.value.url = s.url;
    if (typeof s.dataPath === 'string') apiMode.value.dataPath = s.dataPath;
    if (Array.isArray(s.headers)) apiMode.value.headers = s.headers;
    if (typeof s.body === 'string') apiMode.value.body = s.body;
    if (Array.isArray(s.extract)) apiMode.value.extract = s.extract;
    if (s.pagination && typeof s.pagination === 'object') apiMode.value.pagination = s.pagination;
  };

  const getHtmlModeSnapshot = () => {
    return {
      targetUrl: targetUrl.value,
      requestMethod: requestMethod.value,
      fields: cloneFields(),
      listMode: listMode.value,
      listSelector: listSelector.value,
      headers: cloneHeaders(),
      requestTimeout: requestTimeout.value,
      proxyUrl: proxyUrl.value,
      acceptInvalidCerts: acceptInvalidCerts.value,
      autoExitOnPick: autoExitOnPick.value,
      autoAdvanceOnPick: autoAdvanceOnPick.value,
      startUrlsText: startUrlsText.value,
      crawlMaxPages: crawlMaxPages.value,
      crawlConcurrency: crawlConcurrency.value,
      crawlDelayMs: crawlDelayMs.value,
      crawlRetry: crawlRetry.value,
      discoverLinksSelector: discoverLinksSelector.value,
      discoverLinksAttr: discoverLinksAttr.value,
      discoverLinksCustomAttr: discoverLinksCustomAttr.value,
      nextPageSelector: nextPageSelector.value,
      nextPageAttr: nextPageAttr.value,
      nextPageCustomAttr: nextPageCustomAttr.value,
      crawlDedupEnabled: crawlDedupEnabled.value,
      crawlDedupKey: crawlDedupKey.value,
      crawlClearOnStart: crawlClearOnStart.value
    };
  };

  const applyHtmlModeSnapshot = (config) => {
    if (!config || typeof config !== 'object') return;
    if (typeof config.targetUrl === 'string') targetUrl.value = config.targetUrl;
    if (typeof config.requestMethod === 'string') requestMethod.value = config.requestMethod;
    if (Array.isArray(config.fields)) {
      fields.length = 0;
      fields.push(...normalizeFields(config.fields));
    }
    if (typeof config.listMode === 'boolean') listMode.value = config.listMode;
    if (typeof config.listSelector === 'string') listSelector.value = config.listSelector;
    if (Array.isArray(config.headers)) requestHeaders.value = config.headers;
    if (typeof config.requestTimeout === 'number') requestTimeout.value = config.requestTimeout;
    if (typeof config.proxyUrl === 'string') proxyUrl.value = config.proxyUrl;
    if (typeof config.acceptInvalidCerts === 'boolean') acceptInvalidCerts.value = config.acceptInvalidCerts;
    if (typeof config.autoExitOnPick === 'boolean') autoExitOnPick.value = config.autoExitOnPick;
    if (typeof config.autoAdvanceOnPick === 'boolean') autoAdvanceOnPick.value = config.autoAdvanceOnPick;
    if (typeof config.startUrlsText === 'string') startUrlsText.value = config.startUrlsText;
    if (typeof config.crawlMaxPages === 'number') crawlMaxPages.value = config.crawlMaxPages;
    if (typeof config.crawlConcurrency === 'number') crawlConcurrency.value = config.crawlConcurrency;
    if (typeof config.crawlDelayMs === 'number') crawlDelayMs.value = config.crawlDelayMs;
    if (typeof config.crawlRetry === 'number') crawlRetry.value = config.crawlRetry;
    if (typeof config.discoverLinksSelector === 'string') discoverLinksSelector.value = config.discoverLinksSelector;
    if (typeof config.discoverLinksAttr === 'string') discoverLinksAttr.value = config.discoverLinksAttr;
    if (typeof config.discoverLinksCustomAttr === 'string') discoverLinksCustomAttr.value = config.discoverLinksCustomAttr;
    if (typeof config.nextPageSelector === 'string') nextPageSelector.value = config.nextPageSelector;
    if (typeof config.nextPageAttr === 'string') nextPageAttr.value = config.nextPageAttr;
    if (typeof config.nextPageCustomAttr === 'string') nextPageCustomAttr.value = config.nextPageCustomAttr;
    if (typeof config.crawlDedupEnabled === 'boolean') crawlDedupEnabled.value = config.crawlDedupEnabled;
    if (typeof config.crawlDedupKey === 'string') crawlDedupKey.value = config.crawlDedupKey;
    if (typeof config.crawlClearOnStart === 'boolean') crawlClearOnStart.value = config.crawlClearOnStart;
  };

  const getCurrentConfigSnapshot = () => {
    return {
      version: 3,
      htmlMode: getHtmlModeSnapshot(),
      apiMode: getApiModeSnapshot()
    };
  };

  const applyConfigSnapshot = (config) => {
    if (!config || typeof config !== 'object') return;

    if (config.htmlMode && typeof config.htmlMode === 'object') {
      applyHtmlModeSnapshot(config.htmlMode);
      if (config.apiMode && typeof config.apiMode === 'object') {
        applyApiModeSnapshot(config.apiMode);
      }
      return;
    }

    applyHtmlModeSnapshot(config);
  };

  const notifyConfigApplied = () => {
    try {
      onConfigApplied?.();
    } catch (_) {}
  };

  const scheduleAutosave = () => {
    if (autosaveTimer.value) clearTimeout(autosaveTimer.value);
    autosaveTimer.value = setTimeout(() => {
      try {
        localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(getCurrentConfigSnapshot()));
      } catch (_) {}
    }, 400);
  };

  watch(
    () => getCurrentConfigSnapshot(),
    () => scheduleAutosave(),
    { deep: true }
  );

  const loadLastConfig = () => {
    try {
      const raw = localStorage.getItem(LAST_CONFIG_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        applyConfigSnapshot(parsed);
        notifyConfigApplied();
      }
    } catch (_) {}
  };

  const loadUrlHistory = () => {
    try {
      const raw = localStorage.getItem(URL_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      urlHistory.value = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (_) {
      urlHistory.value = [];
    }
  };

  const saveUrlHistory = () => {
    try {
      localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(urlHistory.value.slice(0, MAX_URL_HISTORY)));
    } catch (_) {}
  };

  const addToHistory = (url) => {
    const u = normalizedUrl(url);
    if (!u) return;
    urlHistory.value = [u, ...urlHistory.value.filter((x) => x !== u)].slice(0, MAX_URL_HISTORY);
    saveUrlHistory();
  };

  const clearUrlHistory = () => {
    urlHistory.value = [];
    saveUrlHistory();
    messageApi?.success?.('已清空 URL 历史');
  };

  const urlHistoryOptions = computed(() => {
    const q = (targetUrl.value || '').trim().toLowerCase();
    const list = q ? urlHistory.value.filter((u) => u.toLowerCase().includes(q)) : urlHistory.value;
    return list.slice(0, 8).map((u) => ({ value: u }));
  });

  const onSelectHistoryUrl = (value) => {
    targetUrl.value = value;
  };

  const loadTemplates = () => {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      templates.value = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      templates.value = [];
    }
  };

  const saveTemplates = () => {
    try {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.value || []));
    } catch (_) {}
  };

  const templateOptions = computed(() => {
    return (templates.value || []).map((t) => ({ label: t.name, value: t.id }));
  });

  const openSaveTemplate = () => {
    templateModalMode.value = 'save';
    templateNameInput.value = '';
    templateModalVisible.value = true;
  };

  const openLoadTemplate = () => {
    templateModalMode.value = 'load';
    selectedTemplateId.value = '';
    templateModalVisible.value = true;
  };

  const confirmSaveTemplate = () => {
    const name = (templateNameInput.value || '').trim();
    if (!name) {
      messageApi?.warning?.('请输入模板名称');
      return;
    }
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const snapshot = getCurrentConfigSnapshot();
    templates.value = [{ id, name, snapshot, updatedAt: Date.now() }, ...(templates.value || [])];
    saveTemplates();
    templateModalVisible.value = false;
    messageApi?.success?.('模板已保存');
  };

  const confirmLoadTemplate = () => {
    const id = selectedTemplateId.value;
    const tpl = (templates.value || []).find((t) => t.id === id);
    if (!tpl) {
      messageApi?.warning?.('请选择模板');
      return;
    }
    applyConfigSnapshot(tpl.snapshot);
    templateModalVisible.value = false;
    notifyConfigApplied();
    messageApi?.success?.('模板已加载');
  };

  const deleteSelectedTemplate = () => {
    const id = selectedTemplateId.value;
    if (!id) return;
    templates.value = (templates.value || []).filter((t) => t.id !== id);
    saveTemplates();
    selectedTemplateId.value = '';
    messageApi?.success?.('模板已删除');
  };

  const exportRules = () => {
    const config = getCurrentConfigSnapshot();
    downloadFile('scraper-rules.json', JSON.stringify(config, null, 2));
  };

  const triggerImport = () => {
    fileInput.value?.click?.();
  };

  const importRules = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        applyConfigSnapshot(config);
        notifyConfigApplied();
        messageApi?.success?.('规则导入成功');
      } catch (_) {
        messageApi?.error?.('规则文件解析失败');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const disposeStorage = () => {
    if (autosaveTimer.value) {
      clearTimeout(autosaveTimer.value);
      autosaveTimer.value = null;
    }
  };

  return {
    urlHistory,
    urlHistoryOptions,
    loadUrlHistory,
    addToHistory,
    clearUrlHistory,
    onSelectHistoryUrl,

    templates,
    templateModalVisible,
    templateModalMode,
    templateNameInput,
    selectedTemplateId,
    templateOptions,
    loadTemplates,
    openSaveTemplate,
    openLoadTemplate,
    confirmSaveTemplate,
    confirmLoadTemplate,
    deleteSelectedTemplate,

    fileInput,
    exportRules,
    triggerImport,
    importRules,

    loadLastConfig,
    applyConfigSnapshot,
    getCurrentConfigSnapshot,
    disposeStorage
  };
}
