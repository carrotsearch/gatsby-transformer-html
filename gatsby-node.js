const path = require("path");
const fs = require("fs");
const crypto = require('crypto');

const _ = require("lodash");
const cheerio = require("cheerio");
const { GraphQLJSON } = require(`gatsby/graphql`);

const highlight = require("gatsby-remark-prismjs/highlight-code.js");
const { fluid } = require("gatsby-plugin-sharp");

// The transformation functions should be converted to plugins, but
// for now we keep them integrated to avoid proliferation of boilerplate.

const isRelativeUrl = url => {
  return url && !/^(https?:\/\/)|^\/|^#/i.test(url);
};

// Maps file extensions to the language to use for highlighting.
const languageForExtension = {
  "html": "markup",
  "js": "javascript",
  "xml": "xml"
};

/**
 * Calls the "gatsby-remark-prismjs" plugin's highlighting code and returns
 * the appropriate HTML.
 */
const highlightFragment = ($el, lang, code) => {
  const className = [$el.attr("class"), `language-${lang}`].filter(e => !!e).join(" ");

  return `<div class="gatsby-highlight">
    <pre class="${className}"><code data-language="${lang}">${highlight(lang, code, false).trim()}</code></pre>
  </div>`;
};

/**
 * Embeds code from a separate file. Relative file path provided in the
 * data-embed attribute is resolved against the path of the file in which
 * the embed tag appears.
 */
const embedCode = ($, dir) => {
  $("pre[data-embed]")
    .replaceWith((i, el) => {
      const $el = $(el);
      const embed = $el.data("embed");

      const embedAbsolute = path.resolve(dir, embed);
      if (!fs.existsSync(embedAbsolute)) {
        fail(`relative path ${embed}, resolved to ${embedAbsolute} does not exist.`);
      }

      if (!fs.statSync(embedAbsolute).isFile()) {
        fail(`path ${embed} must point to a file.`);
      }

      const ext = path.extname(embedAbsolute).substring(1).toLowerCase();
      const language = languageForExtension[ext];
      if (!language) {
        fail(`unknown language for ${embed}`);
      }

      const content = fs.readFileSync(embedAbsolute, "utf8");

      // Ideally, we should just insert the raw contents and have it
      // highlighted in the dedicated code below, but cheerio has problems
      // serializing certain HTML tags (html, head, body), so we have to
      // highlight them here before cheerio has a chance to remove them.
      return highlightFragment($el, language, content);

      function fail(message) {
        throw `Failed to embed content: ${message}.`;
      }
    });

  return $;
};

/**
 * Highlights code snippets in place. The code reuses the highlighting
 * internals from the "gatsby-remark-prismjs" plugin.
 */
const highlightCode = $ => {
  // The $ wrapper is a mutable DOM/jQuery-like representation, so
  // we only need to select and modify links, returning the original $ reference.
  $("pre[data-language]")
    .replaceWith((i, el) => {
      const $el = $(el);
      return highlightFragment($el, $el.data("language"), $el.html());
    });
  return $;
};

/**
 * Rewrites local HTML links into links required by Gatsby. We do this to be
 * able to preserve working links in the source HTML files while feeding Gatsby
 * with absolute no-extension links it requires.
 */
const rewriteLinks = $ => {
  // The $ wrapper is a mutable DOM/jQuery-like representation, so
  // we only need to select and modify links, returning the original $ reference.
  $("a")
    .filter((i, link) => {
      const href = link.attribs.href;

      // Must end with .html
      return isRelativeUrl(href) && /\.html(#.*)?$/i.test(href);
    })
    .attr("href", (i, href) => {
      return "/" + href.replace(/\.html((#.*)?)$/i, "$1");
    });

  return $;
};

/**
 * Process images through "gatsby-plugin-sharp". This will copy and optimize
 * the image in multiple resolutions for different devices.
 */
const processImages = async ($, fileNodesByPath, reporter, cache) => {
  const $img = $("img");

  // Collect images whose relative paths point at existing files.
  const imageNodesToProcess = [];
  $img.each((i, img) => {
    const src = img.attribs.src;
    if (_.has(fileNodesByPath, src)) {
      imageNodesToProcess.push(fileNodesByPath[src]);
    } else {
      reporter.warn(`Image file not found for img src ${src}.`);
    }
  });

  // Process the images through the sharp plugin.
  const processed = await Promise.all(
    imageNodesToProcess.map(n => fluid({
      file: n,
      args: { maxWidth: 40 * 18 },
      reporter,
      cache
    }))
  );
  const processedByRelativePath = processed.reduce((map, fluid, i) => {
    map[imageNodesToProcess[i].relativePath] = fluid;
    return map;
  }, {});

  // Replace the images in the HTML.
  $img
    .filter((i, img) => _.has(processedByRelativePath, img.attribs.src))
    .replaceWith((i, img) => {
      const fluid = processedByRelativePath[img.attribs.src];
      const className = [img.attribs.class, "fluid"].filter(e => !!e).join(" ");
      const ratio = `${(1 / fluid.aspectRatio) * 100}%`;
      return `<div style="position: relative">
        <span style="padding-bottom: ${ratio}; background-image: url('${fluid.base64}')" 
              class="fluid preview"> </span>
        <img class="${className}"
             alt="${img.attribs.alt || ""}"
             title="${img.attribs.title || ""}"
             src="${fluid.src}"
             srcSet="${fluid.srcSet}"
             sizes="${fluid.sizes}" />
      </div>`;
    });
  return $;
};

const anchorSvg = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16"><path fill-rule="evenodd" d="M4 9h1v1H4c-1.5 0-3-1.69-3-3.5S2.55 3 4 3h4c1.45 0 3 1.69 3 3.5 0 1.41-.91 2.72-2 3.25V8.59c.58-.45 1-1.27 1-2.09C10 5.22 8.98 4 8 4H4c-.98 0-2 1.22-2 2.5S3 9 4 9zm9-3h-1v1h1c1 0 2 1.22 2 2.5S13.98 12 13 12H9c-.98 0-2-1.22-2-2.5 0-.83.42-1.64 1-2.09V6.25c-1.09.53-2 1.84-2 3.25C6 11.31 7.55 13 9 13h4c1.45 0 3-1.69 3-3.5S14.5 6 13 6z" /></svg>`;

const addSectionAnchors = $ => {
  $("section[id] > :header")
    .filter((i, el) => el.name !== "h1")
    .replaceWith((i, el) => {
      const $el = $(el);
      return `<${el.name}>
        <a class="anchor" href="#${$el.parent().attr("id")}" aria-hidden="true">${anchorSvg}</a>${$el.text()}
      </${el.name}>`;
    });
  return $;
};

const generateId = text => crypto.createHash('md5')
  .update(text).digest("hex").substring(16);

const addIdsForIndexableFragments = $ => {
  forEachFullTextFragment($, $f => {
    const hasId = !!$f.attr("id");
    if (!hasId) {
      $f.attr("id", generateId(normalize($f.text())));
    }
  });
  $(".warning, .info").each((i, e) => {
    const $e = $(e);
    if (!$e.attr("id")) {
      $e.attr("id", generateId(normalize($e.text())));
    }
  });
  return $;
};

/**
 * The cheerio HTML parser when emitting modified HTML globally replaces
 * certain characters (<>") with HTML entities. It also replaces quotes
 * with entities inside HTML tags, which breaks the rendering of highlighted
 * Javascript snippets.
 *
 * To work around this we switch off entity replacement in cheerio, but
 * then it also does not escape < inside tags, which also breaks rendering.
 * This method patches this problem by replacing < with entities in
 * the final serialized HTML.
 */
const fixClosingTagsInHighlightedCode = html => {
  return html.replace(/<span class="token punctuation"><(\/?)<\/span>/g,
                      `<span class="token punctuation">&lt;$1</span>`)
             .replace(/<span class="token doctype"></g,
                      `<span class="token doctype">&lt;`);
};

// Gatsby API implementation
const onCreateNode = async ({
                              node,
                              actions,
                              loadNodeContent,
                              createNodeId,
                              createContentDigest,
                              getNodesByType,
                              reporter,
                              cache
                            }) => {
  const { createNode, createParentChildLink } = actions;

  if (node.internal.mediaType !== `text/html` || node.internal.type !== "File") {
    return;
  }

  const fileNodesByPath = _.keyBy(getNodesByType("File"), n => n.relativePath);
  const rawHtml = await loadNodeContent(node);

  // For correct highlighting of HTML code, we need to disable
  // entity resolution in cheerio and then patch this in the
  // serialized HTML, see fixClosingTagsInHighlightedCode() below.
  let $ = cheerio.load(rawHtml, { decodeEntities: false });
  $ = await processImages($, fileNodesByPath, reporter, cache);
  $ = rewriteLinks($);
  $ = addSectionAnchors($);
  $ = embedCode($, node.dir);
  $ = highlightCode($);
  $ = addIdsForIndexableFragments($);

  const rewrittenHtml = fixClosingTagsInHighlightedCode($.html("article"));

  const htmlNode = {
    html: rewrittenHtml,
    frontmatter: {
      id: node.name,
      title: $("h1").eq(0).text()
    },

    id: createNodeId(`${node.id} >>> HTML`),
    children: [],
    parent: node.id,
    internal: {
      contentDigest: createContentDigest(rawHtml),
      type: "Html",
    },
  };

  createNode(htmlNode);
  createParentChildLink({ parent: node, child: htmlNode });
};

/**
 * Builds a table of contents JSON based on section nesting and headings.
 */
const createToc = $ => {
  return $("article > section[id]").map(function asToc(i, e) {
    const $section = $(e);
    const $subsections = $section.children("section[id]");
    return {
      heading: $section.children(":header").eq(0).text(),
      anchor: $section.attr("id"),
      ...$subsections.length > 0 && { sections: $subsections.map(asToc).get() }
    };
  }).get();
};

const removeEmpty = a => {
  return a.filter(e => !!e).join(" ");
};

const forEachFullTextFragment = ($, cb) => {
  const elements = [ "p", "li"];

  elements.forEach(tag => {
    $(`${tag}`).each((i, e) => {
      const $e = $(e);
      if ($e.parents("[data-marker]").length > 0 ||
        $e.find("[data-marker]").length > 0) {
        return;
      }
      cb($e);
      $e.attr("data-marker", "");
    });
  });

  $("[data-marker]").removeAttr("data-marker");
};

const headingExtractors = [
  {
    selector: "article",
    type: "heading",
    class: () => "section",
    text: $e => $e.children(":header").text()
  },
  {
    selector: "section[id]",
    type: "heading",
    class: () => "section",
    text: $e => $e.children(":header").text()
  },
  {
    selector: "code[id]",
    type: "code",
    class: () => "api",
    text: $e => $e.text()
  },
  {
    selector: "figure[id]",
    type: "figure",
    class: $e => {
      if ($e.find("img, picture").length > 0) {
        return "image";
      }
      if ($e.find("pre").length > 0) {
        return "example";
      }
      return "figure";
    },
    text: $e => {
      const $caption = $e.find("figcaption");
      if ($caption.children().length > 0) {
        return $caption.children().eq(0).text();
      } else {
        return $caption.text();
      }
    }
  },
  {
    selector: ".warning, .info",
    type: "heading",
    class: () => null,
    text: $e => $e.find("strong").eq(0).text()
  }
];

const normalize = t => {
  return t.trim().replace(/(\s|\n)+/g, " ");
};

const collectIndexableFragments = $ => {
  const fragments = [];
  if ($("article").data("indexing") === "disabled") {
    return fragments;
  }

  const extractParents = $e => $e.parents("section, article, .warning, .info")
    .children(":header, strong")
    .map((i, heading) => $(heading).text().trim()).get().reverse();

  headingExtractors.forEach(extractor => {
    $(extractor.selector).each((i, e) => {
      const $e = $(e);
      fragments.push({
        text: normalize(extractor.text($e)),
        type: extractor.type,
        id: $e.attr("id") || "",
        parents: extractParents($e),
        class: removeEmpty([extractor.class($e), $e.attr("class")])
      });
    });
  });

  forEachFullTextFragment($, $f => {
    fragments.push({
      text: normalize($f.text().trim()),
      type: "paragraph",
      id: $f.attr("id"),
      parents: extractParents($f),
      class: removeEmpty([$f.attr("class")])
    })
  });

  return fragments;
};

const setFieldsOnGraphQLNodeType = ({ type }) => {
  if (type.name === "Html") {
    return {
      tableOfContents: {
        type: GraphQLJSON,
        resolve: (node) => {
          return createToc(cheerio.load(node.html));
        }
      },
      indexableFragments: {
        type: GraphQLJSON,
        resolve: (node) => {
          return collectIndexableFragments(cheerio.load(node.html));
        }
      }
    }
  }
};

exports.onCreateNode = onCreateNode;
exports.setFieldsOnGraphQLNodeType = setFieldsOnGraphQLNodeType;