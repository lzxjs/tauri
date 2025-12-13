import { computed } from 'vue';

export function useScraperCodegen({
  targetUrl,
  fields,
  listMode,
  listSelector,
  requestHeaders,
  codeLanguage,
  codeModalVisible,
  messageApi
}) {
  const sanitizeIdentifier = (raw) => {
    let s = String(raw || '').trim();
    if (!s) return '';
    s = s.replace(/\s+/g, '_');
    s = s.replace(/[^a-zA-Z0-9_$]/g, '_');
    s = s.replace(/_+/g, '_');
    if (!/^[a-zA-Z_$]/.test(s)) s = `_${s}`;
    return s;
  };

  const isValidJsIdentifier = (name) => {
    const s = String(name || '');
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s);
  };

  const makeUniqueName = (base, used) => {
    let n = base;
    let i = 2;
    while (used.has(n)) {
      n = `${base}_${i}`;
      i += 1;
    }
    used.add(n);
    return n;
  };

  const buildFieldCodeMeta = () => {
    const used = new Set();
    return fields
      .filter((f) => f && f.name && f.selector)
      .map((f, idx) => {
        const key = String(f.name);
        const base = sanitizeIdentifier(key) || `field_${idx + 1}`;
        const varName = makeUniqueName(`val_${base}`, used);
        return { f, key, varName };
      });
  };

  const jsStringLiteral = (s) => JSON.stringify(String(s ?? ''));

  const pyStringLiteral = (s) => {
    const str = String(s ?? '');
    return `'${str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
    }'`;
  };

  const showCodeModal = () => {
    codeModalVisible.value = true;
  };

  const headersObject = computed(() => {
    return (requestHeaders.value || []).reduce((acc, h) => {
      if (h && h.key) acc[h.key] = h.value;
      return acc;
    }, {});
  });

  const generateNodeCode = () => {
    const metas = buildFieldCodeMeta();

    const processField = (f, varName) => {
      let code = '';
      let extract = '';
      switch (f.attr) {
        case 'text':
          extract = '.text()';
          break;
        case 'html':
          extract = '.html()';
          break;
        case 'href':
          extract = '.attr("href")';
          break;
        case 'src':
          extract = '.attr("src")';
          break;
        case 'custom':
          extract = `.attr(${jsStringLiteral(f.customAttr)})`;
          break;
        default:
          extract = '.text()';
      }

      code += `    let ${varName} = el.find(${jsStringLiteral(f.selector)})${extract};\n`;

      if (f.attr === 'text' && f.transformType === 'none') {
        code += `    if (${varName}) ${varName} = ${varName}.trim();\n`;
      }

      if (f.transformType === 'trim') {
        code += `    if (${varName}) ${varName} = ${varName}.trim();\n`;
      } else if (f.transformType === 'regex' && f.transformPattern) {
        code += `    const ${varName}_match = ${varName} ? ${varName}.match(new RegExp(${jsStringLiteral(f.transformPattern)})) : null;\n`;
        code += `    ${varName} = ${varName}_match ? (${varName}_match[1] || ${varName}_match[0]) : "";\n`;
      } else if (f.transformType === 'replace' && f.transformPattern) {
        code += `    if (${varName}) ${varName} = ${varName}.replace(new RegExp(${jsStringLiteral(f.transformPattern)}, 'g'), ${jsStringLiteral(f.transformReplacement || '')});\n`;
      }

      return code;
    };

    const fieldsProcessing = metas
      .map(({ f, varName }) => processField(f, varName))
      .join('\n');

    const fieldsAssignment = metas
      .map(({ key, varName }) => `      ${isValidJsIdentifier(key) ? key : jsStringLiteral(key)}: ${varName}`)
      .join(',\n');

    const headersJson = JSON.stringify(headersObject.value, null, 4).replace(/\n/g, '\n     ');

    if (listMode.value) {
      return `const axios = require('axios');
const cheerio = require('cheerio');

async function scrape() {
  const url = ${jsStringLiteral(targetUrl.value)};
  const { data } = await axios.get(url, {
     headers: ${headersJson}
  });
  const $ = cheerio.load(data);
  const results = [];

  $(${jsStringLiteral(listSelector.value)}).each((i, element) => {
    const el = $(element);
${fieldsProcessing}
    results.push({
${fieldsAssignment}
    });
  });

  console.log(JSON.stringify(results, null, 2));
}

scrape();`;
    }

    const singleProcessing = metas
      .map(({ f, varName }) => {
        let code = `    // ${f.name}\n`;
        let extract = '';
        switch (f.attr) {
          case 'text':
            extract = '.text()';
            break;
          case 'html':
            extract = '.html()';
            break;
          case 'href':
            extract = '.attr("href")';
            break;
          case 'src':
            extract = '.attr("src")';
            break;
          case 'custom':
            extract = `.attr(${jsStringLiteral(f.customAttr)})`;
            break;
          default:
            extract = '.text()';
        }
        code += `    let ${varName} = $(${jsStringLiteral(f.selector)})${extract};\n`;
        if (f.attr === 'text' && f.transformType === 'none') {
          code += `    if (${varName}) ${varName} = ${varName}.trim();\n`;
        }
        if (f.transformType === 'trim') {
          code += `    if (${varName}) ${varName} = ${varName}.trim();\n`;
        } else if (f.transformType === 'regex' && f.transformPattern) {
          code += `    const ${varName}_match = ${varName} ? ${varName}.match(new RegExp(${jsStringLiteral(f.transformPattern)})) : null;\n`;
          code += `    ${varName} = ${varName}_match ? (${varName}_match[1] || ${varName}_match[0]) : "";\n`;
        } else if (f.transformType === 'replace' && f.transformPattern) {
          code += `    if (${varName}) ${varName} = ${varName}.replace(new RegExp(${jsStringLiteral(f.transformPattern)}, 'g'), ${jsStringLiteral(f.transformReplacement || '')});\n`;
        }
        return code;
      })
      .join('\n');

    return `const axios = require('axios');
const cheerio = require('cheerio');

async function scrape() {
  const url = ${jsStringLiteral(targetUrl.value)};
  const { data } = await axios.get(url, {
     headers: ${headersJson}
  });
  const $ = cheerio.load(data);

${singleProcessing}
  const result = {
${fieldsAssignment}
  };

  console.log(JSON.stringify(result, null, 2));
}

scrape();`;
  };

  const generatePythonCode = () => {
    const metas = buildFieldCodeMeta();

    const processField = (f, varName, isList) => {
      let code = '';
      const elVar = isList ? 'el' : 'soup';
      const selectMethod = 'select_one';

      code += `        element = ${elVar}.${selectMethod}(${pyStringLiteral(f.selector)})\n`;

      let extract = '';
      switch (f.attr) {
        case 'text':
          extract = '.get_text()';
          break;
        case 'html':
          extract = '.decode_contents()';
          break;
        case 'href':
          extract = '.get("href")';
          break;
        case 'src':
          extract = '.get("src")';
          break;
        case 'custom':
          extract = `.get(${pyStringLiteral(f.customAttr)})`;
          break;
        default:
          extract = '.get_text()';
      }

      code += `        ${varName} = element${extract} if element else None\n`;

      if (f.attr === 'text' && f.transformType === 'none') {
        code += `        if ${varName}: ${varName} = ${varName}.strip()\n`;
      }
      if (f.transformType === 'trim') {
        code += `        if ${varName}: ${varName} = ${varName}.strip()\n`;
      } else if (f.transformType === 'regex' && f.transformPattern) {
        code += `        if ${varName}:\n`;
        code += `            match = re.search(${pyStringLiteral(f.transformPattern)}, ${varName})\n`;
        code += `            ${varName} = match.group(1) if match and match.lastindex and match.lastindex >= 1 else (match.group(0) if match else "")\n`;
      } else if (f.transformType === 'replace' && f.transformPattern) {
        code += `        if ${varName}: ${varName} = re.sub(${pyStringLiteral(f.transformPattern)}, ${pyStringLiteral(f.transformReplacement || '')}, ${varName})\n`;
      }

      return code;
    };

    const fieldsAssignment = metas
      .map(({ key, varName }) => `            ${pyStringLiteral(key)}: ${varName}`)
      .join(',\n');

    const headersPy = JSON.stringify(headersObject.value, null, 4)
      .replace(/\n/g, '\n    ')
      .replace(/true/g, 'True')
      .replace(/false/g, 'False');

    if (listMode.value) {
      const fieldProcessors = metas
        .map(({ f, varName }) => processField(f, varName, true))
        .join('\n');

      return `import requests
from bs4 import BeautifulSoup
import json
import re

def scrape():
    url = ${pyStringLiteral(targetUrl.value)}
    headers = ${headersPy}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')

    results = []
    for el in soup.select(${pyStringLiteral(listSelector.value)}):
${fieldProcessors}        results.append({
${fieldsAssignment}
        })

    print(json.dumps(results, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    scrape()`;
    }

    const fieldProcessors = metas
      .map(({ f, varName }) => processField(f, varName, false))
      .join('\n')
      .replace(/^        /gm, '    ');

    return `import requests
from bs4 import BeautifulSoup
import json
import re

def scrape():
    url = ${pyStringLiteral(targetUrl.value)}
    headers = ${headersPy}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')

${fieldProcessors}
    data = {
${fieldsAssignment}
    }

    print(json.dumps(data, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    scrape()`;
  };

  const generatedCode = computed(() => {
    if (codeLanguage.value === 'node') {
      return generateNodeCode();
    }
    return generatePythonCode();
  });

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode.value);
      messageApi?.success?.('复制成功');
    } catch (_) {
      messageApi?.error?.('复制失败');
    }
  };

  const downloadCode = () => {
    const ext = codeLanguage.value === 'node' ? 'js' : 'py';
    const blob = new Blob([generatedCode.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scraper.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    generatedCode,
    showCodeModal,
    copyCode,
    downloadCode
  };
}
