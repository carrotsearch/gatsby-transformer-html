const cheerio = require("cheerio");
const { generateElementId } = require("./generate-element-id.js");

require("must/register");

describe("generateElementId must", function () {
  it("prefix generated id with existing parent id", function () {
    const $ = cheerio.load(`
      <div id="section">
        <p>paragraph</p>
      </div>
    `);

    generateElementId($("p"), t => t, new Set());

    $("p").eq(0).attr("id").must.equal("section:32a97fa2");
  });

  it("not fail if there is no parent with id", function () {
    const $ = cheerio.load(`
      <div id="section">
        <p>paragraph</p>
      </div>
    `);

    generateElementId($("p"), t => t, new Set());

    $("p").eq(0).attr("id").must.equal("section:32a97fa2");
  });
});