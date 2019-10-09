exports.removeCommonIndent = content => {
  if (!content) {
    return "";
  }

  const lines = content.split(/[\r\n]/);
  if (lines.length === 0) {
    return content;
  }

  let indentChar;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 0) {
      indentChar = lines[i].charAt(0);
      break;
    }
  }

  if (!indentChar || (indentChar !== " " && indentChar !== "\t")) {
    return content;
  }

  let maxIndent = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length === 0) {
      continue;
    }
    maxIndent = Math.min(maxIndent, countIndentChars(lines[i], indentChar));
  }

  if (maxIndent === Number.MAX_SAFE_INTEGER) {
    return content;
  }

  return lines.map(l => l.substring(maxIndent)).join("\n");

  function countIndentChars(line, indentChar) {
    let count = 0;
    while (count < line.length && line.charAt(count) === indentChar) {
      count++;
    }
    return count;
  }
};