const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_cdp_safe_eval`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const rx = /async function evaluateOnCdpPage\s*\(client,\s*expression\)\s*\{[\s\S]*?\n\}/;

const replacement = `async function evaluateOnCdpPage(client, expression) {
  async function runEvaluate(expr, returnByValue = true) {
    const result = await client.Runtime.evaluate({
      expression: expr,
      awaitPromise: true,
      returnByValue,
      userGesture: true,
    });

    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      const exception = details.exception || {};
      const description = exception.description || exception.value || exception.className || details.text || 'CDP evaluate lỗi.';
      const location = \`\${details.url || ''}:\${details.lineNumber ?? ''}:\${details.columnNumber ?? ''}\`;
      throw new Error(\`\${details.text || 'CDP evaluate lỗi'}: \${description}\${location !== '::' ? \` @ \${location}\` : ''}\`);
    }

    return result.result?.value;
  }

  try {
    return await runEvaluate(expression, true);
  } catch (error) {
    const message = String(error?.message || error || '');

    if (!/Object reference chain is too long|Object couldn't be returned by value|Converting circular structure/i.test(message)) {
      throw error;
    }

    const safeExpression = \`
      (async () => {
        const __seen = new WeakSet();
        const __maxDepth = 6;
        const __maxArray = 80;
        const __maxKeys = 80;

        function __safe(value, depth = 0) {
          if (value == null) return value;

          const type = typeof value;
          if (type === 'string') return value.length > 20000 ? value.slice(0, 20000) + '…[truncated]' : value;
          if (type === 'number' || type === 'boolean') return value;
          if (type === 'bigint') return String(value);
          if (type === 'function' || type === 'symbol' || type === 'undefined') return undefined;

          if (depth >= __maxDepth) return '[MaxDepth]';

          if (value instanceof ArrayBuffer) return { type: 'ArrayBuffer', byteLength: value.byteLength };
          if (ArrayBuffer.isView(value)) {
            return {
              type: value.constructor && value.constructor.name || 'TypedArray',
              length: value.length,
              byteLength: value.byteLength,
              sample: Array.from(value.slice ? value.slice(0, 32) : []).slice(0, 32),
            };
          }

          if (value instanceof Element) {
            const rect = value.getBoundingClientRect?.();
            return {
              type: 'Element',
              tag: value.tagName,
              id: value.id || '',
              className: String(value.className || '').slice(0, 200),
              text: String(value.innerText || value.textContent || '').slice(0, 500),
              box: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
            };
          }

          if (value instanceof Node) {
            return {
              type: 'Node',
              nodeType: value.nodeType,
              nodeName: value.nodeName,
              text: String(value.textContent || '').slice(0, 500),
            };
          }

          if (Array.isArray(value)) {
            if (__seen.has(value)) return '[Circular]';
            __seen.add(value);
            return value.slice(0, __maxArray).map((item) => __safe(item, depth + 1));
          }

          if (type === 'object') {
            if (__seen.has(value)) return '[Circular]';
            __seen.add(value);

            const out = {};
            const keys = Object.keys(value).slice(0, __maxKeys);
            for (const key of keys) {
              try {
                out[key] = __safe(value[key], depth + 1);
              } catch (_err) {
                out[key] = '[Unreadable]';
              }
            }
            if (Object.keys(value).length > __maxKeys) out.__truncatedKeys = Object.keys(value).length - __maxKeys;
            return out;
          }

          return String(value);
        }

        try {
          const __value = await (\${expression});
          return JSON.stringify({ ok: true, value: __safe(__value) });
        } catch (__error) {
          return JSON.stringify({
            ok: false,
            error: String(__error && (__error.stack || __error.message) || __error),
          });
        }
      })()
    \`;

    const json = await runEvaluate(safeExpression, true);
    let parsed = null;

    try {
      parsed = JSON.parse(String(json || '{}'));
    } catch (parseError) {
      throw new Error(\`CDP safe-eval parse failed after "\${message}": \${parseError.message}\`);
    }

    if (!parsed?.ok) {
      throw new Error(parsed?.error || message);
    }

    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: 'CDP evaluate fallback: returned safe JSON after Object reference chain error.',
      details: { originalError: message },
    }).catch(() => null);

    return parsed.value;
  }
}`;

if (!rx.test(s)) {
  console.log('FAIL: Không tìm thấy function evaluateOnCdpPage để thay.');
} else {
  s = s.replace(rx, replacement);
  fs.writeFileSync(p, s, 'utf8');
  console.log('OK: patched evaluateOnCdpPage safe fallback');
  console.log('Backup:', backup);
}
