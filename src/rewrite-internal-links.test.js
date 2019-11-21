const { rewriteInternalUrl } = require("./rewrite-internal-links.js");
require("must/register");

describe("rewriteInternalUrl", function () {
  it("must rewrite regular page links", function () {
    const input = "page.html";
    const replaced = rewriteInternalUrl(input);

    replaced.must.be.equal("/page/");
  });

  it("must keep hash", function () {
    const input = "page.html#hash";
    const replaced = rewriteInternalUrl(input);

    replaced.must.be.equal("/page/#hash");
  });
});