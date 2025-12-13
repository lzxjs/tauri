import { watch } from 'vue';

export function useScraperInspector({
  rawHtml,
  processedHtml,
  previewFrame,
  isInspectorActive,
  fields,
  currentFieldIndex,
  autoAdvanceOnPick,
  autoExitOnPick,
  getParsedDoc,
  scheduleRefreshPreview,
  triggerFieldFlash,
  messageApi
}) {
  const injectInspectorScript = (html, baseUrl) => {
    const baseTag = `<base href="${baseUrl}" target="_blank">`;
    let processed = html;
    if (/<head[\s>]/i.test(processed)) {
      processed = processed.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    } else if (/<html[\s>]/i.test(processed)) {
      processed = processed.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`);
    } else {
      processed = `<head>${baseTag}</head>` + processed;
    }

    const script = `
    <script>
      (function() {
        let active = false;
        let highlighted = null;
        let highlightedList = [];

        window.addEventListener('message', (event) => {
          if (event.data.type === 'toggle-inspector') {
            active = event.data.active;
            try {
              document.documentElement.classList.toggle('scraper-inspector-active', !!active);
            } catch (e) {}
            if (!active && highlighted) {
              highlighted.style.outline = '';
              highlighted = null;
            }
          }
          if (event.data.type === 'highlight-selector') {
            try {
              highlightedList.forEach(el => { try { el.style.outline = ''; } catch (_) {} });
              highlightedList = [];
              const selector = event.data.selector;
              if (!selector) return;
              const list = Array.from(document.querySelectorAll(selector));
              list.forEach(el => { el.style.outline = '2px dashed #52c41a'; });
              highlightedList = list;
              if (list[0] && list[0].scrollIntoView) list[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
            } catch (e) {}
          }
        });

        document.addEventListener('mouseover', (e) => {
          if (!active) return;
          e.stopPropagation();

          if (highlighted) highlighted.style.outline = '';
          e.target.style.outline = '2px solid #1890ff';
          highlighted = e.target;
        }, true);

        document.addEventListener('mouseout', (e) => {
          if (!active) return;
          e.target.style.outline = '';
        }, true);

        document.addEventListener('click', (e) => {
          if (!active) return;
          e.preventDefault();
          e.stopPropagation();

          const selector = generateSelector(e.target);
          window.parent.postMessage({
            type: 'element-selected',
            selector: selector,
            tagName: e.target.tagName,
            text: e.target.innerText.slice(0, 50)
          }, '*');
        }, true);

        function generateSelector(el) {
          const tag = (el && el.tagName) ? el.tagName.toLowerCase() : '';
          if (tag === 'html') return 'html';
          if (tag === 'body') return 'body';

          function isUnique(selector) {
            try {
              return document.querySelectorAll(selector).length === 1;
            } catch (e) {
              return false;
            }
          }

          function generalizedIdSelector(tagName, id) {
            const raw = String(id || '');
            const m = raw.match(/^([a-zA-Z_-]+)_([0-9]{5,})$/);
            if (m) {
              const prefix = m[1];
              const sel = (tagName ? tagName : '') + '[id^="' + prefix + '_"]';
              return sel;
            }
            return '';
          }

          if (el.id) {
            const gen = generalizedIdSelector(tag, el.id);
            if (gen && isUnique(gen)) return gen;
            return '#' + el.id;
          }

          const ignoreClasses = new Set([
            'active', 'on', 'cur', 'current', 'hover', 'clearfix', 'fl', 'fr'
          ]);
          const classList = Array.from(el.classList || []).filter(Boolean).filter(c => !ignoreClasses.has(c));
          if (classList.length) {
            const c = classList[0];
            const sel = tag + '.' + CSS.escape(c);
            if (isUnique(sel)) return sel;
          }

          const path = [];
          let node = el;
          while (node && node.nodeType === Node.ELEMENT_NODE) {
            let selector = node.nodeName.toLowerCase();

            if (node.id) {
              const gen = generalizedIdSelector(selector, node.id);
              if (gen && isUnique(gen)) {
                path.unshift(gen);
                break;
              }
              selector += '#' + node.id;
              path.unshift(selector);
              break;
            }

            const cls = Array.from(node.classList || []).filter(Boolean).filter(c => !ignoreClasses.has(c));
            if (cls.length) {
              const maybe = selector + '.' + CSS.escape(cls[0]);
              if (isUnique(maybe)) {
                path.unshift(maybe);
                break;
              }
            }

            let sib = node, nth = 1;
            while (sib = sib.previousElementSibling) {
              if (sib.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
            path.unshift(selector);
            node = node.parentNode;
            if (node && node.tagName && node.tagName.toLowerCase() === 'body') break;
          }

          const full = path.join(' > ');
          if (!full) return tag;

          try {
            const parts = full.split(' > ').map(x => x.trim()).filter(Boolean);
            for (let i = 0; i < parts.length; i++) {
              const candidate = parts.slice(i).join(' > ');
              if (candidate && isUnique(candidate)) return candidate;
            }
          } catch (e) {}

          return full;
        }
      })();
    <\/script>
    <style>
      .scraper-inspector-active iframe,
      .scraper-inspector-active object,
      .scraper-inspector-active embed { pointer-events: none; }
    </style>
  `;

    return processed + script;
  };

  const highlightSelectorInPreview = (selector) => {
    const sel = (selector || '').trim();
    if (!sel) return;
    if (!processedHtml.value) return;
    if (!previewFrame.value || !previewFrame.value.contentWindow) return;
    previewFrame.value.contentWindow.postMessage({
      type: 'highlight-selector',
      selector: sel
    }, '*');
  };

  watch(isInspectorActive, (active) => {
    if (!rawHtml.value) {
      if (active) messageApi?.warning?.('请先加载页面');
      if (active) isInspectorActive.value = false;
      return;
    }
    if (previewFrame.value && previewFrame.value.contentWindow) {
      previewFrame.value.contentWindow.postMessage({
        type: 'toggle-inspector',
        active
      }, '*');
    }
  });

  const isDefaultFieldName = (name) => {
    const s = String(name || '').trim();
    return !s || /^field_\d+$/i.test(s);
  };

  const suggestFieldNameFromPick = (payload, index) => {
    const tag = String(payload?.tagName || '').toLowerCase();
    let text = String(payload?.text || '').trim();
    text = text.replace(/\s+/g, ' ').trim();
    text = text.replace(/[\u0000-\u001F]/g, '');
    let base = text || tag || `field_${index + 1}`;
    base = base.replace(/\s+/g, '_');
    base = base.replace(/[^\w\u4e00-\u9fa5$-]/g, '_');
    base = base.replace(/_+/g, '_');
    base = base.replace(/^_+|_+$/g, '');
    if (!base) base = tag || `field_${index + 1}`;
    if (base.length > 20) base = base.slice(0, 20);

    const used = new Set(fields.map((f) => String(f?.name || '').trim()).filter(Boolean));
    let candidate = base;
    let i = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${i}`;
      i += 1;
    }
    return candidate;
  };

  const isSelectorUnique = (doc, selector) => {
    try {
      return doc.querySelectorAll(selector).length === 1;
    } catch (_) {
      return false;
    }
  };

  const optimizeSelector = (selector) => {
    const s = (selector || '').trim();
    if (!s) return s;
    const doc = getParsedDoc();
    if (!doc) return s;

    const generalizeDynamicIds = (sel) => {
      return sel.replace(/([a-z0-9_-]+)?#([a-zA-Z_-]+)_([0-9]{5,})/g, (m, tag, prefix) => {
        const t = tag ? tag : '';
        return `${t}[id^="${prefix}_"]`;
      });
    };

    if (s.includes('#')) {
      const gen = generalizeDynamicIds(s);
      if (gen !== s && isSelectorUnique(doc, gen)) return gen;
      return s;
    }

    let best = s;
    const withoutNthAll = best.replace(/:nth-of-type\(\d+\)/g, '');
    if (withoutNthAll && isSelectorUnique(doc, withoutNthAll)) best = withoutNthAll;

    const parts = best.split(' > ').map((x) => x.trim()).filter(Boolean);
    for (let cut = 0; cut < parts.length - 1; cut++) {
      const candidate = parts.slice(cut).join(' > ');
      if (candidate && isSelectorUnique(doc, candidate)) best = candidate;
    }

    return best;
  };

  const handleMessage = (event) => {
    if (event?.data?.type !== 'element-selected') return;

    const idx = currentFieldIndex.value;
    if (idx === -1 || !fields[idx]) return;

    fields[idx].selector = optimizeSelector(String(event.data.selector || ''));
    if (isDefaultFieldName(fields[idx].name)) {
      fields[idx].name = suggestFieldNameFromPick(event.data, idx);
    }

    triggerFieldFlash?.(idx);
    messageApi?.success?.(`已选择: ${event.data.tagName}`);
    scheduleRefreshPreview?.();

    if (autoAdvanceOnPick.value) {
      if (currentFieldIndex.value < fields.length - 1) {
        currentFieldIndex.value += 1;
      }
    }

    if (autoExitOnPick.value) {
      isInspectorActive.value = false;
    }
  };

  return {
    injectInspectorScript,
    highlightSelectorInPreview,
    handleMessage
  };
}
