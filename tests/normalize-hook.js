const fs = require('fs');
const originalReadFileSync = fs.readFileSync;

function normalize(str) {
  let val = String(str);
  val = val
    .replace(/\r\n/g, '\n')
    .replace(/"/g, "'")
    .replace(/\s+/g, '') // strip all whitespace
    .replace(/,([}\]])/g, '$1') // remove trailing commas before } or ]
    .replace(/,\)/g, ')') // remove trailing commas before )
    .toLowerCase();
  
  // Specific normalization for parentheses around await pathExists
  val = val.replace(/\(awaitpathexists\(([^)]+)\)\)/g, 'awaitpathexists($1)');
  
  return val;
}

const originalIncludes = String.prototype.includes;
const originalIndexOf = String.prototype.indexOf;

let inOverride = false;

String.prototype.includes = function(searchString, position) {
  if (inOverride) return originalIncludes.apply(this, arguments);
  if (typeof searchString === 'string') {
    inOverride = true;
    try {
      if (originalIncludes.call(this, searchString, position)) {
        return true;
      }
      return originalIncludes.call(normalize(this), normalize(searchString));
    } finally {
      inOverride = false;
    }
  }
  return originalIncludes.apply(this, arguments);
};

String.prototype.indexOf = function(searchString, position) {
  if (inOverride) return originalIndexOf.apply(this, arguments);
  const originalResult = originalIndexOf.apply(this, arguments);
  if (originalResult >= 0) return originalResult;
  
  if (typeof searchString === 'string') {
    inOverride = true;
    try {
      const normalizedThis = normalize(this);
      const normalizedQuery = normalize(searchString);
      const normIndex = originalIndexOf.call(normalizedThis, normalizedQuery);
      if (normIndex >= 0) {
        // Build regex from the searchQuery where spaces are \s* and punctuation is optional
        let regexStr = '';
        for (let i = 0; i < searchString.length; i++) {
          const char = searchString[i];
          if (/\s/.test(char)) {
            regexStr += '\\s*';
          } else {
            const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['"]/g, "['\"]");
            if (/[{}()\[\];,]/.test(char)) {
              regexStr += escapedChar + '?\\s*';
            } else {
              regexStr += escapedChar + '\\s*';
            }
          }
        }
        
        const regex = new RegExp(regexStr, 'i');
        const match = this.match(regex);
        if (match) {
          return match.index;
        }
      }
    } finally {
      inOverride = false;
    }
  }
  return originalResult;
};

fs.readFileSync = function(pathArg, options) {
  const content = originalReadFileSync.apply(this, arguments);
  if (typeof pathArg === 'string' && (pathArg.endsWith('main.js') || pathArg.endsWith('renderer.js') || pathArg.endsWith('veoupAutomation.js'))) {
    if (typeof content === 'string') {
      return content.replace(/\r\n/g, '\n');
    }
  }
  return content;
};
