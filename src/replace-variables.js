const VARIABLE_REGEX = /^\w+$/;
const VARIABLE_WITH_DELIMITER_REGEX = /%(\w+)%/g;

exports.replaceVariables = (html, replacer) => {
  return html.replace(VARIABLE_WITH_DELIMITER_REGEX, function (match, name, offset) {
    return replacer(name, offset);
  });
};

exports.validateVariables = variables => {
  // Validate variable names
  const offending = Object.keys(variables).filter(v => !VARIABLE_REGEX.test(v));
  if (offending.length > 0) {
    throw "Variable names must match [A-Za-z0-9_], offending names: " + offending.join(", ") + ".";
  }
};

exports.createMapReplacer = map => {
  return name => map[name];
};