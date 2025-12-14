import { ref, computed } from 'vue';

export function useScraperNovelActions({
  invoke,
  messageApi,
  buildRequestHeadersObject,
  requestTimeout,
  proxyUrl,
  acceptInvalidCerts
}) {
  // --- Preview Logic ---
  const previewModalVisible = ref(false);
  const previewLoading = ref(false);
  const previewResult = ref({ title: '', content: '', url: '' });

  const previewChapter = async (chapterUrl, titleSelector, contentSelector, cleanRegexText, cleanEnabled) => {
    if (!chapterUrl) return;
    
    previewLoading.value = true;
    previewModalVisible.value = true;
    previewResult.value = { title: '加载中...', content: '正在获取章节内容...', url: chapterUrl };

    try {
      const html = await invoke('fetch_url_decoded', {
        req: {
          url: chapterUrl,
          headers: buildRequestHeadersObject(),
          timeoutMs: requestTimeout.value,
          proxyUrl: proxyUrl.value,
          acceptInvalidCerts: acceptInvalidCerts.value
        }
      });

      const doc = new DOMParser().parseFromString(html, 'text/html');
      
      // Title
      let title = '';
      if (titleSelector) {
        const titleEl = doc.querySelector(titleSelector);
        title = titleEl ? (titleEl.textContent || '').trim() : '未找到标题元素';
      } else {
        title = '未设置标题选择器';
      }

      // Content
      let content = '';
      if (contentSelector) {
        const contentEl = doc.querySelector(contentSelector);
        if (contentEl) {
          // Clone to avoid modifying doc if we were reusing it (we aren't)
          const clone = contentEl.cloneNode(true);
          
          // Clean
          if (cleanEnabled && cleanRegexText) {
            const lines = cleanRegexText.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
            // Simple text-based removal from innerHTML or textContent? 
            // Better to match backend logic usually, but here we do a simple preview.
            // We'll just display raw text for now, or maybe simple HTML.
            // Let's stick to textContent for preview to be safe and clear.
            // Actually users might want to see HTML structure or formatting.
            // Let's get innerHTML but maybe strip scripts.
            
            // Remove scripts/styles
            const scripts = clone.querySelectorAll('script, style, iframe');
            scripts.forEach(s => s.remove());
            
            let text = clone.innerHTML; 
            // Simple regex replacement on the HTML string for preview
             lines.forEach(pattern => {
               try {
                 const re = new RegExp(pattern, 'g');
                 text = text.replace(re, '');
               } catch (e) {
                 // ignore invalid regex
               }
             });
             // Basic BR to newline for readability in text preview
             content = text; 
          } else {
             content = clone.innerHTML;
          }
        } else {
          content = '未找到正文元素';
        }
      } else {
        content = '未设置正文选择器';
      }

      previewResult.value = {
        title,
        content,
        url: chapterUrl
      };

    } catch (e) {
      previewResult.value = {
        title: '获取失败',
        content: `错误: ${e.message}`,
        url: chapterUrl
      };
      messageApi.error('预览失败');
    } finally {
      previewLoading.value = false;
    }
  };

  // --- Range Logic ---
  const rangeStart = ref(1);
  const rangeEnd = ref(0); // 0 means end

  const getFilteredChapters = (allChapters) => {
    if (!allChapters || !allChapters.length) return [];
    
    let start = Math.max(1, parseInt(rangeStart.value) || 1) - 1; // 0-indexed
    let end = parseInt(rangeEnd.value) || allChapters.length;
    
    if (end <= 0) end = allChapters.length;
    if (end > allChapters.length) end = allChapters.length;
    if (start < 0) start = 0;
    if (start >= end) return [];

    return allChapters.slice(start, end);
  };

  return {
    previewModalVisible,
    previewLoading,
    previewResult,
    previewChapter,
    rangeStart,
    rangeEnd,
    getFilteredChapters
  };
}
