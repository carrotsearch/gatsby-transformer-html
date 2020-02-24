const VARIABLE_WITH_DELIMITER_REGEX = /%(\w+)%/g;
exports.replaceVariables = (html, replacer) => {
  return html.replace(VARIABLE_WITH_DELIMITER_REGEX, (match, name, offset) =>
    replacer(name, offset)
  );
};

const VARIABLE_REGEX = /^\w+$/;
exports.validateVariables = variables => {
  // Validate variable names
  if (!variables) {
    return;
  }
  const offending = Object.keys(variables).filter(v => !VARIABLE_REGEX.test(v));
  if (offending.length > 0) {
    throw 'Variable names must match [A-Za-z0-9_], offending names: ' +
      offending.join(', ') +
      '.';
  }
};

exports.createMapReplacer = map => {
  return name => {
    if (!map) {
      console.log(`trying to map :  ${name}`);
      return;
    }
    return map[name];
  };
};
