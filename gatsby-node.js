const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const _ = require('lodash');
const cheerio = require('cheerio');
const { GraphQLJSON } = require(`gatsby/graphql`);

const highlight = require('gatsby-remark-prismjs/highlight-code.js');
const { fluid } = require('gatsby-plugin-sharp');

const {
  replaceVariables,
  validateVariables,
  createMapReplacer,
} = require('./src/replace-variables.js');
const { removeCommonIndent } = require('./src/remove-common-indent.js');
const { rewriteInternalLinks } = require('./src/rewrite-internal-links.js');
const extractFragment = require('./src/extract-fragment.js');

// The transformation functions should be converted to plugins, but
// for now we keep them integrated to avoid proliferation of boilerplate.

const notInPre = $ => (i, el) => $(el).parents('pre').length === 0;
const indexingAllowed = $ => (i, el) => $(el).data('indexing') !== 'disabled';

/**
 * Calls the "gatsby-remark-prismjs" plugin's highlighting code and returns
 * the appropriate HTML.
 */
const highlightFragment = ($el, lang, code) => {
  const className = [$el.attr('class'), `language-${lang}`]
    .filter(e => !!e)
    .join(' ');

  return `<div class="gatsby-highlight">
    <pre class="${className}"><code data-language="${lang}">${highlight(
    lang,
    code,
    false
  )}</code></pre>
  </div>`;
};

const warn = (message, reporter) => {
  const dot = message.endsWith('.' ? '' : '.');
  reporter.warn(`Failed to embed content: ${message}${dot}`);
};

const loadEmbeddedContent = (declaredEmbed, dir, variables, reporter) => {
  // Replace variables in the path. We don't care about the semantics
  // here, it's up to the caller to ensure the path makes sense and is safe.
  const embed = replaceVariables(declaredEmbed, name => {
    let value = variables[name] || '';
    if (value.endsWith('/' || value.endsWith('\\'))) {
      return value.substring(0, value.length - 1);
    } else {
      return value;
    }
  });

  const embedAbsolute = path.resolve(dir, embed);
  if (!fs.existsSync(embedAbsolute)) {
    warn(
      `relative path ${embed}, resolved to ${embedAbsolute} does not exist.`,
      reporter
    );
    return undefined;
  }

  if (!fs.statSync(embedAbsolute).isFile()) {
    warn(`path ${embed} must point to a file.`, reporter);
    return undefined;
  }

  return fs.readFileSync(embedAbsolute, 'utf8');
};

/**
 * Embeds code from a separate file. Relative file path provided in the
 * data-embed attribute is resolved against the path of the file in which
 * the embed tag appears.
 */
const embedCode = ($, dir, variables, reporter) => {
  $('pre[data-embed]')
    .filter(notInPre($))
    .replaceWith((i, el) => {
      const $el = $(el);
      const declaredEmbed = $el.data('embed');
      const fragment = $el.data('fragment');
      const declaredLanguage = $el.data('language');
      const preserveIndent = $el.data('preserve-common-indent');

      const rawContent = loadEmbeddedContent(
        declaredEmbed,
        dir,
        variables,
        reporter
      );

      if (rawContent === undefined) {
        return '';
      }

      const ext = path
        .extname(declaredEmbed)
        .substring(1)
        .toLowerCase();
      const language = declaredLanguage || ext;

      let content;
      if (fragment) {
        try {
          content = extractFragment(rawContent, fragment);
        } catch (e) {
          warn(e, reporter);
          content = '';
        }
      } else {
        content = rawContent;
      }

      if (!preserveIndent) {
        content = removeCommonIndent(content);
      }

      // Ideally, we should just insert the raw contents and have it
      // highlighted in the dedicated code below, but cheerio has problems
      // serializing certain HTML tags (html, head, body), so we have to
      // highlight them here before cheerio has a chance to remove them.
      return highlightFragment($el, language, content);
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
  $('pre[data-language]').replaceWith((i, el) => {
    const $el = $(el);
    const preserveIndent = $el.data('preserve-common-indent');

    let html = $el.html();
    if (!preserveIndent) {
      html = removeCommonIndent(html);
    }
    return highlightFragment($el, $el.data('language'), html);
  });
  return $;
};

const fixImageSrc = (node, src) => {
  let absSrc = src;

  if (!absSrc.startsWith('/')) {
    absSrc = `${node.relativeDirectory}/${absSrc}`;
  } else {
    absSrc = absSrc.slice(1);
  }

  return absSrc;
};
/**
 * Process images through "gatsby-plugin-sharp". This will copy and optimize
 * the image in multiple resolutions for different devices.
 */
const processImages = async (
  node,
  $,
  fileNodesByPath,
  pathPrefix,
  reporter,
  cache
) => {
  const $img = $('img').filter(notInPre($));

  // Collect images whose relative paths point at existing files.
  const imageNodesToProcess = [];
  $img.each((i, img) => {
    const src = fixImageSrc(node, img.attribs.src);

    if (_.has(fileNodesByPath, src)) {
      imageNodesToProcess.push(fileNodesByPath[src]);
    } else {
      reporter.warn(`Image file not found for img src ${src}.`);
    }
  });

  // Process the images through the sharp plugin.
  const processed = await Promise.all(
    imageNodesToProcess.map(n =>
      fluid({
        file: n,
        args: { maxWidth: 40 * 18, pathPrefix },
        reporter,
        cache,
      })
    )
  );
  const processedByRelativePath = processed.reduce((map, fluid, i) => {
    map[imageNodesToProcess[i].relativePath] = fluid;
    return map;
  }, {});

  // Replace the images in the HTML.
  $img
    .filter((i, img) =>
      _.has(processedByRelativePath, fixImageSrc(node, img.attribs.src))
    )
    .replaceWith((i, img) => {
      const fluid = processedByRelativePath[fixImageSrc(node, img.attribs.src)];
      /*
      const className = [img.attribs.class, 'fluid'].filter(e => !!e).join(' ');
      const ratio = `${(1 / fluid.aspectRatio) * 100}%`;
      return `<div style="position: relative">
        <span style="padding-bottom: ${ratio}; background-image: url('${
        fluid.base64
      }')" 
              class="fluid preview"> </span>
        <img class="${className}"
             alt="${img.attribs.alt || ''}"
             title="${img.attribs.title || ''}"
             src="${fluid.src}"
             srcSet="${fluid.srcSet}"
             sizes="${fluid.sizes}" />
      </div>`;
      */
      return `
        <img 
             alt="${img.attribs.alt || ''}"
             title="${img.attribs.title || ''}"
             src="${fluid.src}"
             srcSet="${fluid.srcSet}"
             sizes="${fluid.sizes}" />
      `;
    });
  return $;
};

const anchorSvg = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16"><path fill-rule="evenodd" d="M4 9h1v1H4c-1.5 0-3-1.69-3-3.5S2.55 3 4 3h4c1.45 0 3 1.69 3 3.5 0 1.41-.91 2.72-2 3.25V8.59c.58-.45 1-1.27 1-2.09C10 5.22 8.98 4 8 4H4c-.98 0-2 1.22-2 2.5S3 9 4 9zm9-3h-1v1h1c1 0 2 1.22 2 2.5S13.98 12 13 12H9c-.98 0-2-1.22-2-2.5 0-.83.42-1.64 1-2.09V6.25c-1.09.53-2 1.84-2 3.25C6 11.31 7.55 13 9 13h4c1.45 0 3-1.69 3-3.5S14.5 6 13 6z" /></svg>`;

const addSectionAnchors = $ => {
  $('section[id] > :header')
    .filter((i, el) => el.name !== 'h1')
    .filter((i, el) => $(el).parents('pre[data-language]').length === 0) // don't process HTML inside pre
    .replaceWith((i, el) => {
      const $el = $(el);
      return `<${el.name}>
        <a class="anchor" href="#${$el
          .parent()
          .attr('id')}" aria-hidden="true">${anchorSvg}</a>${$el.html()}
      </${el.name}>`;
    });
  return $;
};

const generateId = text =>
  crypto
    .createHash('md5')
    .update(text)
    .digest('hex')
    .substring(8);

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

const setId = ($f, existing) => {
  $f.attr(
    'id',
    makeUnique($f.attr('id') || generateId(normalize($f.text())), existing)
  );
};

const addIdsForIndexableFragments = $ => {
  const existing = new Set();

  forEachFullTextFragment($, $f => setId($f, existing));
  $('.warning, .info').each((i, e) => setId($(e), existing));
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
  return html
    .replace(
      /<span class="token punctuation"><(\/?)<\/span>/g,
      `<span class="token punctuation">&lt;$1</span>`
    )
    .replace(
      /<span class="token doctype"></g,
      `<span class="token doctype">&lt;`
    );
};

/**
 * Builds a table of contents JSON based on section nesting and headings.
 */
const createToc = $ => {
  return $('article > section[id]')
    .filter(notInPre($))
    .map(function asToc(i, e) {
      const $section = $(e);
      const $subsections = $section.children('section[id]');
      return {
        heading: $section
          .children(':header')
          .eq(0)
          .text(),
        anchor: $section.attr('id'),
        ...($subsections.length > 0 && {
          sections: $subsections.map(asToc).get(),
        }),
      };
    })
    .get();
};

const removeEmpty = a => {
  return a.filter(e => !!e).join(' ');
};

const forEachFullTextFragment = ($, cb) => {
  const elements = ['p', 'li'];
  const isIndexed = indexingAllowed($);

  elements.forEach(tag => {
    $(`${tag}`).each((i, e) => {
      const $e = $(e);
      // Don't index the first paragraph of figure
      // caption, it's indexed as a figure heading.
      if ($e.closest('figcaption').length > 0 && $e.is('p:first-child')) {
        return;
      }

      // Don't index if a child of an element with data-indexing="disabled".
      const withFlag = $e.closest('[data-indexing]');
      if (withFlag.length > 0 && !isIndexed(0, withFlag.get(0))) {
        return;
      }

      if (
        $e.parents('[data-marker]').length > 0 ||
        $e.find('[data-marker]').length > 0
      ) {
        return;
      }
      cb($e);
      $e.attr('data-marker', '');
    });
  });

  $('[data-marker]').removeAttr('data-marker');
};

const getFigureCaption = $e => {
  const $caption = $e.find('figcaption');
  if ($caption.children().length > 0) {
    return normalize(
      $caption
        .children()
        .eq(0)
        .text()
    );
  } else {
    return normalize($caption.text());
  }
};

const headingExtractors = [
  {
    selector: 'article',
    type: 'heading',
    class: () => 'section',
    text: $e => $e.children(':header').text(),
  },
  {
    selector: 'section[id]',
    type: 'heading',
    class: () => 'section',
    text: $e => $e.children(':header').text(),
  },
  {
    selector: 'code[id]',
    type: 'code',
    class: () => 'api',
    text: $e => $e.text(),
  },
  {
    selector: 'figure[id]',
    type: 'figure',
    class: $e => {
      if ($e.find('img, picture').length > 0) {
        return 'image';
      }
      if ($e.find('pre').length > 0) {
        return 'example';
      }
      return 'figure';
    },
    text: getFigureCaption,
  },
  {
    selector: '.warning, .info',
    type: 'heading',
    class: () => null,
    text: $e =>
      $e
        .find('strong')
        .eq(0)
        .text(),
  },
];

const normalize = t => {
  return t.trim().replace(/(\s|\n)+/g, ' ');
};

const collectIndexableFragments = $ => {
  const isIndexed = indexingAllowed($);
  const fragments = [];
  if (!isIndexed(0, $('article'))) {
    return fragments;
  }

  const extractParents = ($e, includeCaption) => {
    const headings = $e
      .parents('section, article, .warning, .info')
      .children(':header, strong')
      .map((i, heading) => normalize($(heading).text()))
      .get()
      .reverse();

    // For paragraphs inside figure caption,
    // add figure heading to the list of parents.
    const $f = $e.closest('figure');
    if (includeCaption && $f.length > 0) {
      headings.push(getFigureCaption($f));
    }

    return headings;
  };

  headingExtractors.forEach(extractor => {
    $(extractor.selector)
      .filter(isIndexed)
      .each((i, e) => {
        const $e = $(e);
        fragments.push({
          text: normalize(extractor.text($e)),
          type: extractor.type,
          id: $e.attr('id') || '',
          parents: extractParents($e, false),
          class: removeEmpty([extractor.class($e), $e.attr('class')]),
        });
      });
  });

  forEachFullTextFragment($, $f => {
    fragments.push({
      text: normalize($f.text().trim()),
      type: 'paragraph',
      id: $f.attr('id'),
      parents: extractParents($f, true),
      class: removeEmpty([$f.attr('class')]),
    });
  });

  return fragments;
};

// Gatsby API implementation
const onCreateNode = async ({
  node,
  actions,
  loadNodeContent,
  createNodeId,
  createContentDigest,
}) => {
  const { createNode, createParentChildLink } = actions;

  if (
    node.internal.mediaType !== `text/html` ||
    node.internal.type !== 'File'
  ) {
    return;
  }

  const rawHtml = await loadNodeContent(node);
  let $ = cheerio.load(rawHtml, { decodeEntities: false });

  const frontmatter = {
    id: node.name,
    title: normalize(
      $('title')
        .eq(0)
        .text()
    ),
  };

  const metaTags = $('meta');

  if (metaTags) {
    metaTags.each((idx, meta) => {
      console.log(meta);
      if (meta.attribs.name) {
        frontmatter[meta.attribs.name] = meta.attribs.content;
      }
    });
  }

  const htmlNode = {
    rawHtml: rawHtml,
    frontmatter,
    id: createNodeId(`${node.id} >>> HTML`),
    children: [],
    parent: node.id,
    dir: node.dir,
    name: node.name,
    relativeDirectory: node.relativeDirectory,
    internal: {
      contentDigest: createContentDigest(rawHtml),
      type: 'Html',
    },
  };

  createNode(htmlNode);
  createParentChildLink({ parent: node, child: htmlNode });
};

const setFieldsOnGraphQLNodeType = (
  { type, getNodesByType, reporter, cache, pathPrefix },
  { variables, transformers }
) => {
  if (type.name === 'Html') {
    const runTransformers = ($, dir) => {
      if (transformers) {
        for (let i = 0; i < transformers.length; i++) {
          $ = transformers[i]($, {
            dir,
            variables,
            reporter,
            loadEmbeddedContent,
          });
        }
      }
      return $;
    };

    return {
      html: {
        type: 'String',
        resolve: async node => {
          const fileNodesByPath = _.keyBy(
            getNodesByType('File'),
            n => n.relativePath
          );

          // For correct highlighting of HTML code, we need to disable
          // entity resolution in cheerio and then patch this in the
          // serialized HTML, see fixClosingTagsInHighlightedCode() below.
          let $ = cheerio.load(node.rawHtml, { decodeEntities: false });
          $ = runTransformers($, node.dir);
          console.log('processing html');
          $ = await processImages(
            node,
            $,
            fileNodesByPath,
            pathPrefix,
            reporter,
            cache
          );
          $ = rewriteInternalLinks($);
          $ = addSectionAnchors($);
          $ = embedCode($, node.dir, variables, reporter);
          $ = highlightCode($);
          $ = addIdsForIndexableFragments($);

          let html = fixClosingTagsInHighlightedCode($.html('article'));
          html = replaceVariables(html, createMapReplacer(variables));

          return html;
        },
      },
      tableOfContents: {
        type: GraphQLJSON,
        resolve: node => {
          return createToc(cheerio.load(node.rawHtml));
        },
      },
      indexableFragments: {
        type: GraphQLJSON,
        resolve: node => {
          let $ = cheerio.load(node.rawHtml);
          $ = runTransformers($, node.dir);
          $ = addIdsForIndexableFragments($);
          return collectIndexableFragments($);
        },
      },
    };
  }
};

const onPreBootstrap = ({ reporter }, { variables }) => {
  try {
    validateVariables(variables);
  } catch (e) {
    reporter.panic(e);
  }
};

exports.onPreBootstrap = onPreBootstrap;
exports.onCreateNode = onCreateNode;
exports.setFieldsOnGraphQLNodeType = setFieldsOnGraphQLNodeType;
