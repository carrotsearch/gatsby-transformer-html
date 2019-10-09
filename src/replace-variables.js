const DELIMITER = "%";
const VARIABLE_REGEX = /^\w+$/;

module.exports = (html, variables) => {
  if (!variables) {
    return html;
  }

  // Validate variable names
  const offending = Object.keys(variables).filter(v => !VARIABLE_REGEX.test(v));
  if (offending.length > 0) {
    throw "Variable names must match [A-Za-z0-9_], offending names: " + offending.join(", ") + ".";
  }

  // Make replacements
  const re = new RegExp(
    Object
      .keys(variables)
      .map(v => `${DELIMITER}(${v})${DELIMITER}`)
      .join("|"),
    "g"
  );

  return html.replace(re, function (match) {
    const name = match.substring(1, match.length - 1);
    return variables[name];
  });
};