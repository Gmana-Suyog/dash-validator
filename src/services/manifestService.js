export class ManifestService {
  async loadManifest(url) {
    try {
      const response = await fetch(url, {
        cache: 'no-store'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const text = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');

      if (xml.querySelector('parsererror')) {
        throw new Error('Invalid XML: ' + xml.querySelector('parsererror').textContent);
      }

      return xml;
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error.message}`);
    }
  }

  extractMpdInfo(xml) {
    if (!xml) return {};
    const mpd = xml.querySelector('MPD');
    if (!mpd) return {};

    const attributes = {
      'mediaPresentationDuration': mpd.getAttribute('mediaPresentationDuration') || '',
      'minBufferTime': mpd.getAttribute('minBufferTime') || '',
      'profiles': mpd.getAttribute('profiles') || '',
      'type': mpd.getAttribute('type') || '',
      'availabilityStartTime': mpd.getAttribute('availabilityStartTime') || '',
      'publishTime': mpd.getAttribute('publishTime') || '',
      'minimumUpdatePeriod': mpd.getAttribute('minimumUpdatePeriod') || '',
      'timeShiftBufferDepth': mpd.getAttribute('timeShiftBufferDepth') || '',
      'maxSegmentDuration': mpd.getAttribute('maxSegmentDuration') || ''
    };

    const baseUrl = xml.querySelector('BaseURL')?.textContent || '';
    if (baseUrl) attributes['BaseURL'] = baseUrl;

    return attributes;
  }

  formatManifest(xml) {
    if (!xml) return '';
    return this.prettyPrintXML(xml);
  }

  prettyPrintXML(xmlDoc) {
    const serializer = new XMLSerializer();
    const xmlStr = serializer.serializeToString(xmlDoc);
    let formatted = '';
    let indent = '';
    const indentStep = '  ';

    xmlStr.split(/>\s*</).forEach((node, index) => {
      if (node.match(/^\/\w/)) {
        indent = indent.slice(indentStep.length);
      }
      formatted += `${indent}${index === 0 ? node : `<${node}>`}\n`;
      if (node.match(/^<?\w[^>]*[^/]$/) && !node.match(/^<\w[^>]*\/>/)) {
        indent += indentStep;
      }
    });

    return formatted;
  }
}