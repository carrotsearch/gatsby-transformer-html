const rewriteInternalUrl = url => {
  return "/" + url.replace(/(.*)\.html(#.*)?$/i, "$1/$2");
};

const isRelativeUrl = url => {
  return url && !/^(https?:\/\/)|^\/|^#/i.test(url);
};

exports.rewriteInternalUrl = rewriteInternalUrl;

exports.rewriteInternalLinks = $ => {
  // The $ wrapper is a mutable DOM/jQuery-like representation, so
  // we only need to select and modify links, returning the original $ reference.
  $("a:not([data-external])")
  .filter((i, link) => {
    const href = link.attribs.href;

    // Must end with .html
    return isRelativeUrl(href) && /\.html(#.*)?$/i.test(href);
  })
  .attr("href", (i, href) => {
    return rewriteInternalUrl(href);
  });

  return $;
};