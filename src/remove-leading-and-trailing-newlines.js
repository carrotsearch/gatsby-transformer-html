exports.removeLeadingAndTrailingNewlines = content => {
  if (!content) {
    return "";
  }

  return content.replace(/^(\r?\n)*|(\r?\n)*$/g, "");
};