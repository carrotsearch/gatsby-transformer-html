const OUTSIDE_FRAGMENT = Symbol();
const INSIDE_FRAGMENT = Symbol();

const fragmentMarker = /fragment-(start|end)\{[\w-]+\}/;

module.exports = (content, fragmentId) => {
  if (!content) {
    return "";
  }

  const lines = content.split(/\r?\n/);

  let state = OUTSIDE_FRAGMENT;
  let output = [];

  const startRe = new RegExp(`fragment-start\\{${fragmentId}\\}`);
  const endRe = new RegExp(`fragment-end\\{${fragmentId}\\}`);

  let fragmentFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    switch (state) {
      case OUTSIDE_FRAGMENT:
        if (startRe.test(line)) {
          state = INSIDE_FRAGMENT;
          fragmentFound = true;
          break;
        }
        if (endRe.test(line)) {
          throw `Expecting start of fragment marker for ${fragmentId}, found end of fragment marker.`;
        }
        break;

      case INSIDE_FRAGMENT:
        if (endRe.test(line)) {
          state = OUTSIDE_FRAGMENT;
          break;
        }

        // Omit other fragment markers inside the content we capture
        if (fragmentMarker.test(line)) {
          break;
        }

        output.push(line);
        break;

      default:
        throw "Unknown state.";
    }
  }

  if (state === INSIDE_FRAGMENT) {
    throw `End marker for fragment ${fragmentId} not found.`;
  }

  if (!fragmentFound) {
    throw `Fragment ${fragmentId} not found.`;
  }

  // Line breaks may be different on input, but let's leave that for now.
  return output.join("\n");
};