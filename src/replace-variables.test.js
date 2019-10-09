const { replaceVariables, validateVariables, createMapReplacer } = require("./replace-variables.js");
require("must/register");

describe("validateVariables", function () {
  it("must not allow special characters in variable names", function () {
    let exception;
    try {
      validateVariables({
        "NAME_OK": "",
        "%NOT_OK%": "",
        "SPECIAL$": ""
      });
    } catch (e) {
      exception = e;
    }

    exception.must.not.be.undefined();
    exception.must.contain("%NOT_OK%");
    exception.must.contain("SPECIAL");
    exception.must.not.contain("NAME_OK");
  })
});

describe("replaceVariables", function () {
  it("must make individual replacements", function () {
    const input = "Something %to_replace%";
    const replaced = replaceVariables(input, createMapReplacer({
      "to_replace": "to replace"
    }));

    replaced.must.be.equal("Something to replace");
  });


  it("must make multiple replacements", function () {
    const input = "%sth% %to_replace%%00%with%00%%sth%";
    const replaced = replaceVariables(input, createMapReplacer({
      "sth": "something",
      "to_replace": "to replace",
      "00": " "
    }));

    replaced.must.be.equal("something to replace with something");
  });
});