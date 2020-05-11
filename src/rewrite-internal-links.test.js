const { rewriteInternalUrl, rewriteInternalLinks } = require("./rewrite-internal-links.js");
const cheerio = require("cheerio");

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

describe("rewriteInternalLinks", function () {
  it("must rewrite local links", function () {
    let $ = cheerio.load("<a href='relative/page.html'>test</a>");
    $ = rewriteInternalLinks($);
    $.html().must.contain(`<a href="/relative/page/">test</a>`);
  });

  it("must not rewrite local links with the data-external attribute", function () {
    let $ = cheerio.load("<a href='relative/page.html' data-external>test</a>");
    $ = rewriteInternalLinks($);
    $.html().must.contain(`<a href="relative/page.html" data-external>test</a>`);
  });
});