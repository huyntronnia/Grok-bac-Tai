const CDP = require("chrome-remote-interface");

async function run() {
  const port = 9223;
  let client;
  try {
    const targets = await CDP.List({ host: "127.0.0.1", port });
    const target = targets.find(t => t.type === "page" && t.url.includes("chatgpt.com")) || targets[0];
    if (!target) throw new Error("No chatgpt target found");
    
    client = await CDP({ target, host: "127.0.0.1", port });
    await client.Runtime.enable();
    
    const evalResult = await client.Runtime.evaluate({
      expression: `(() => {
        // Find turn elements
        const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
        
        // Find images and their parent structures
        const images = Array.from(document.querySelectorAll('img')).map(img => {
          let path = img.tagName;
          let p = img.parentElement;
          let depth = 0;
          while (p && depth < 5) {
            path = p.tagName + (p.className ? '.' + p.className.split(' ').join('.') : '') + ' > ' + path;
            p = p.parentElement;
            depth++;
          }
          return {
            src: img.src ? img.src.substring(0, 120) : '',
            className: img.className,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            complete: img.complete,
            path
          };
        });

        // Find containers with class containing "image" or "dalle" or "generation"
        const classMatches = Array.from(document.querySelectorAll('[class*="image"], [class*="dalle"], [class*="generation"]')).map(el => ({
          tagName: el.tagName,
          className: el.className,
          text: el.innerText ? el.innerText.substring(0, 50) : ''
        })).slice(0, 20);

        return {
          turnsCount: turns.length,
          latestTurnHTML: turns.length > 0 ? turns[turns.length - 1].outerHTML.substring(0, 2000) : 'no turns',
          images,
          classMatches
        };
      })()`,
      returnByValue: true
    });
    
    console.log(JSON.stringify(evalResult.result.value, null, 2));
    
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    if (client) await client.close();
  }
}

run();
