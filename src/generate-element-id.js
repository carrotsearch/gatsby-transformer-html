const crypto = require('crypto');

const generateId = (text) =>
  crypto.createHash("md5").update(text).digest("hex").substring(0, 8);

const makeUnique = (id, existing) => {
  let unique;
  if (existing.has(id)) {
    let suffix = 0;
    do {
      unique = `${id}_${suffix}`;
      suffix++;
    } while (existing.has(unique));
  } else {
    unique = id;
  }
  existing.add(unique);
  return unique;
};

exports.generateElementId = ($f, normalize, existing) => {
  const $withId = $f.closest("[id]");
  const prefix = $withId.length > 0 ? $withId.attr("id") + ":" : "";

  const generated = $f.attr("id") || generateId(normalize($f.text()));
  $f.attr(
    "id",
    makeUnique(prefix + generated, existing)
  );
};