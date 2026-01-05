/**
 * MPD Parser - Converts XML to JavaScript objects
 */

/**
 * Parse MPD XML string to JavaScript object
 * @param {string} xmlString - MPD XML content
 * @returns {Object} Parsed MPD object
 */
export function parseMPD(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  if (doc.documentElement.nodeName === "parsererror") {
    throw new Error("Invalid XML: " + doc.documentElement.textContent);
  }

  return xmlToObject(doc.documentElement);
}

/**
 * Convert XML node to JavaScript object
 * @param {Element} node - XML node
 * @returns {Object} JavaScript object representation
 */
function xmlToObject(node) {
  const obj = {};

  // Add attributes
  if (node.attributes) {
    for (const attr of node.attributes) {
      obj[attr.name] = parseValue(attr.value);
    }
  }

  // Add child elements
  const children = {};
  for (const child of node.children) {
    const tagName = child.tagName;
    const childObj = xmlToObject(child);

    if (children[tagName]) {
      if (!Array.isArray(children[tagName])) {
        children[tagName] = [children[tagName]];
      }
      children[tagName].push(childObj);
    } else {
      children[tagName] = childObj;
    }
  }

  // Add text content if no children
  if (Object.keys(children).length === 0 && node.textContent?.trim()) {
    obj._text = node.textContent.trim();
  } else {
    Object.assign(obj, children);
  }

  return obj;
}

/**
 * Parse string value to appropriate type
 * @param {string} value - String value
 * @returns {any} Parsed value
 */
function parseValue(value) {
  // Try to parse as number
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value);
  }

  // Try to parse as boolean
  if (value === "true") return true;
  if (value === "false") return false;

  // Return as string
  return value;
}

/**
 * Expand SegmentTimeline to individual segments
 * @param {Array} timeline - SegmentTimeline S elements
 * @param {number} timescale - Timescale value
 * @returns {Array} Array of segments
 */
export function expandTimeline(timeline, timescale = 1) {
  const segments = [];
  let currentTime = 0;

  for (const s of timeline) {
    const repeat = Number(s.r ?? 0);
    const duration = Number(s.d) / timescale;
    const start = s.t !== undefined ? Number(s.t) / timescale : currentTime;

    for (let i = 0; i <= repeat; i++) {
      segments.push({
        t: start + i * duration,
        d: duration,
      });
    }

    currentTime = start + (repeat + 1) * duration;
  }

  return segments;
}
