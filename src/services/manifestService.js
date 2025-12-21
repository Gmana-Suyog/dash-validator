export class ManifestService {
  constructor() {
    // Base URL for resolving relative URLs
    this.baseUrl = null;
    // Validation mode: 'strict' or 'soft'
    this.validationMode = "strict";
  }

  async loadManifest(url, options = {}) {
    try {
      // Store base URL for relative URL resolution
      this.baseUrl = this.extractBaseUrl(url);
      this.validationMode = options.validationMode || "strict";

      const response = await fetch(url, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`
        );
      }

      const text = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "application/xml");

      // Enhanced error handling with soft validation mode
      const parseError = xml.querySelector("parsererror");
      if (parseError) {
        const errorMsg = parseError.textContent;
        if (this.validationMode === "strict") {
          throw new Error("Invalid XML: " + errorMsg);
        } else {
          console.warn("XML parsing warning:", errorMsg);
          // In soft mode, try to continue with partial parsing
        }
      }

      return xml;
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error.message}`);
    }
  }

  // Helper method to extract base URL from manifest URL
  extractBaseUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.substring(
        0,
        urlObj.pathname.lastIndexOf("/") + 1
      )}`;
    } catch (error) {
      console.warn("Could not extract base URL:", error);
      return null;
    }
  }

  extractMpdInfo(xml) {
    if (!xml) return {};
    const mpd = xml.querySelector("MPD");
    if (!mpd) return {};

    // Enhanced root-level attributes with proper data type conversion
    const attributes = this.extractAllAttributes(mpd, {
      // Duration attributes (convert to seconds for comparison)
      mediaPresentationDuration: {
        type: "duration",
        raw: mpd.getAttribute("mediaPresentationDuration") || "",
      },
      minBufferTime: {
        type: "duration",
        raw: mpd.getAttribute("minBufferTime") || "",
      },
      timeShiftBufferDepth: {
        type: "duration",
        raw: mpd.getAttribute("timeShiftBufferDepth") || "",
      },
      maxSegmentDuration: {
        type: "duration",
        raw: mpd.getAttribute("maxSegmentDuration") || "",
      },
      minimumUpdatePeriod: {
        type: "duration",
        raw: mpd.getAttribute("minimumUpdatePeriod") || "",
      },

      // String attributes
      profiles: { type: "string", raw: mpd.getAttribute("profiles") || "" },
      type: { type: "string", raw: mpd.getAttribute("type") || "" },

      // DateTime attributes
      availabilityStartTime: {
        type: "datetime",
        raw: mpd.getAttribute("availabilityStartTime") || "",
      },
      publishTime: {
        type: "datetime",
        raw: mpd.getAttribute("publishTime") || "",
      },
    });

    // Add missing critical root-level attributes with proper typing
    const suggestedDelay = mpd.getAttribute("suggestedPresentationDelay");
    if (suggestedDelay) {
      attributes["suggestedPresentationDelay"] = {
        type: "duration",
        raw: suggestedDelay,
      };
    }

    // Extract all additional attributes dynamically
    const additionalAttrs = this.extractDynamicAttributes(
      mpd,
      Object.keys(attributes)
    );
    Object.assign(attributes, additionalAttrs);

    // Enhanced BaseURL handling with URL resolution
    const baseUrl = xml.querySelector("BaseURL")?.textContent || "";
    if (baseUrl) {
      attributes["BaseURL"] = {
        type: "url",
        raw: baseUrl,
        resolved: this.resolveUrl(baseUrl),
      };
    }

    // Add comprehensive DASH element extraction
    const extractedElements = this.extractComprehensiveDashElements(xml);

    // Merge extracted elements with existing attributes
    const result = { ...attributes, ...extractedElements };

    // Add validation depth and interdependency checking
    result._validation = this.performSemanticValidation(result, xml);

    return result;
  }

  // Enhanced method to extract all attributes with proper data typing
  extractAllAttributes(element, knownAttributes = {}) {
    const result = {};

    // Process known attributes with type conversion
    Object.entries(knownAttributes).forEach(([name, config]) => {
      result[name] = this.convertAttributeValue(config.raw, config.type);
    });

    return result;
  }

  // Extract dynamic attributes not explicitly defined
  extractDynamicAttributes(element, excludeList = []) {
    const dynamicAttrs = {};

    if (element && element.attributes) {
      Array.from(element.attributes).forEach((attr) => {
        if (!excludeList.includes(attr.name)) {
          // Try to infer type from attribute name and value
          const inferredType = this.inferAttributeType(attr.name, attr.value);
          dynamicAttrs[attr.name] = this.convertAttributeValue(
            attr.value,
            inferredType
          );
        }
      });
    }

    return dynamicAttrs;
  }

  // Infer attribute type from name and value
  inferAttributeType(name, value) {
    if (!value) return "string";

    // Duration patterns
    if (
      name.toLowerCase().includes("time") ||
      name.toLowerCase().includes("duration") ||
      name.toLowerCase().includes("delay") ||
      value.match(/^PT[\d.HMS]+$/)
    ) {
      return "duration";
    }

    // Numeric patterns
    if (
      name.toLowerCase().includes("bandwidth") ||
      name.toLowerCase().includes("rate") ||
      name.toLowerCase().includes("width") ||
      name.toLowerCase().includes("height") ||
      name.toLowerCase().includes("number") ||
      name.toLowerCase().includes("scale") ||
      /^\d+(\.\d+)?$/.test(value)
    ) {
      return "numeric";
    }

    // Boolean patterns
    if (value === "true" || value === "false") {
      return "boolean";
    }

    // DateTime patterns
    if (name.toLowerCase().includes("time") && value.includes("T")) {
      return "datetime";
    }

    // URL patterns
    if (
      name.toLowerCase().includes("url") ||
      name.toLowerCase().includes("uri") ||
      value.startsWith("http") ||
      value.startsWith("//")
    ) {
      return "url";
    }

    return "string";
  }

  // Convert attribute value based on type
  convertAttributeValue(value, type) {
    if (!value) {
      return { type, raw: value || "", parsed: null };
    }

    const result = { type, raw: value };

    try {
      switch (type) {
        case "duration":
          result.parsed = this.parseDurationToSeconds(value);
          break;
        case "numeric":
          result.parsed = parseFloat(value);
          if (isNaN(result.parsed)) result.parsed = null;
          break;
        case "boolean":
          result.parsed = value === "true";
          break;
        case "datetime":
          result.parsed = new Date(value);
          if (isNaN(result.parsed.getTime())) result.parsed = null;
          break;
        case "url":
          result.parsed = value;
          result.resolved = this.resolveUrl(value);
          break;
        default:
          result.parsed = value;
      }
    } catch (error) {
      console.warn(`Failed to parse ${type} value "${value}":`, error);
      result.parsed = null;
    }

    return result;
  }

  // Enhanced parse ISO 8601 duration to seconds with fractional support
  parseDurationToSeconds(duration) {
    if (!duration || typeof duration !== "string") return null;

    // Handle numeric values (assume seconds)
    if (/^\d+(\.\d+)?$/.test(duration)) {
      return parseFloat(duration);
    }

    // Enhanced ISO 8601 duration format parsing with fractional support
    // Supports: PT1H30M45S, PT0.5H, PT30.5M, PT45.123S
    const regex =
      /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/;
    const matches = duration.match(regex);

    if (!matches) {
      // Try alternative formats for edge cases
      const altRegex =
        /^P(?:(\d+(?:\.\d+)?)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/;
      const altMatches = duration.match(altRegex);

      if (altMatches) {
        const days = parseFloat(altMatches[1] || 0);
        const hours = parseFloat(altMatches[2] || 0);
        const minutes = parseFloat(altMatches[3] || 0);
        const seconds = parseFloat(altMatches[4] || 0);
        return days * 86400 + hours * 3600 + minutes * 60 + seconds;
      }

      console.warn(`Failed to parse duration: ${duration}`);
      return null;
    }

    const hours = parseFloat(matches[1] || 0);
    const minutes = parseFloat(matches[2] || 0);
    const seconds = parseFloat(matches[3] || 0);

    return hours * 3600 + minutes * 60 + seconds;
  }

  // Resolve relative URLs to absolute URLs
  resolveUrl(url) {
    if (!url) return url;

    // Already absolute URL
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("//")
    ) {
      return url;
    }

    // Relative URL - resolve against base URL
    if (this.baseUrl) {
      try {
        return new URL(url, this.baseUrl).href;
      } catch (error) {
        console.warn("Failed to resolve URL:", url, error);
        return url;
      }
    }

    return url;
  }

  extractComprehensiveDashElements(xml) {
    const elements = {};

    // 1. UTCTiming extraction
    const utcTiming = xml.querySelector("UTCTiming");
    if (utcTiming) {
      elements.UTCTiming = {
        schemeIdUri: utcTiming.getAttribute("schemeIdUri") || "",
        value: utcTiming.getAttribute("value") || "",
      };
    }

    // 2. Location elements extraction
    const locations = xml.querySelectorAll("Location");
    if (locations.length > 0) {
      elements.Location = Array.from(locations).map(
        (loc) => loc.textContent || ""
      );
    }

    // 3. PatchLocation elements extraction
    const patchLocations = xml.querySelectorAll("PatchLocation");
    if (patchLocations.length > 0) {
      elements.PatchLocation = Array.from(patchLocations).map(
        (loc) => loc.textContent || ""
      );
    }

    // 4. ServiceDescription extraction
    const serviceDesc = xml.querySelector("ServiceDescription");
    if (serviceDesc) {
      elements.ServiceDescription = this.extractServiceDescription(serviceDesc);
    }

    // 5. Root-level ContentProtection (DRM) extraction
    const rootContentProtections = xml.querySelectorAll(
      "MPD > ContentProtection"
    );
    if (rootContentProtections.length > 0) {
      elements.ContentProtection = Array.from(rootContentProtections).map(
        (cp) => this.extractContentProtection(cp)
      );
    }

    // 6. Root-level EssentialProperty extraction
    const rootEssentialProps = xml.querySelectorAll("MPD > EssentialProperty");
    if (rootEssentialProps.length > 0) {
      elements.EssentialProperty = Array.from(rootEssentialProps).map((ep) =>
        this.extractDescriptor(ep)
      );
    }

    // 7. Root-level SupplementalProperty extraction
    const rootSupplementalProps = xml.querySelectorAll(
      "MPD > SupplementalProperty"
    );
    if (rootSupplementalProps.length > 0) {
      elements.SupplementalProperty = Array.from(rootSupplementalProps).map(
        (sp) => this.extractDescriptor(sp)
      );
    }

    // 8. Period-level extraction
    const periods = xml.querySelectorAll("Period");
    if (periods.length > 0) {
      elements.Period = Array.from(periods).map((period) =>
        this.extractPeriod(period)
      );
    }

    return elements;
  }

  extractServiceDescription(serviceDesc) {
    const service = {};

    // Enhanced Latency element with proper data typing
    const latency = serviceDesc.querySelector("Latency");
    if (latency) {
      service.Latency = {
        target: this.convertAttributeValue(
          latency.getAttribute("target") || "",
          "numeric"
        ),
        max: this.convertAttributeValue(
          latency.getAttribute("max") || "",
          "numeric"
        ),
        min: this.convertAttributeValue(
          latency.getAttribute("min") || "",
          "numeric"
        ),
      };
    }

    // Enhanced PlaybackRate element with proper data typing
    const playbackRate = serviceDesc.querySelector("PlaybackRate");
    if (playbackRate) {
      service.PlaybackRate = {
        max: this.convertAttributeValue(
          playbackRate.getAttribute("max") || "",
          "numeric"
        ),
        min: this.convertAttributeValue(
          playbackRate.getAttribute("min") || "",
          "numeric"
        ),
      };
    }

    return service;
  }

  extractPeriod(period) {
    const periodData = {
      // Period attributes with proper data typing
      id: this.convertAttributeValue(period.getAttribute("id") || "", "string"),
      start: this.convertAttributeValue(
        period.getAttribute("start") || "",
        "duration"
      ),
      duration: this.convertAttributeValue(
        period.getAttribute("duration") || "",
        "duration"
      ),
      bitstreamSwitching: this.convertAttributeValue(
        period.getAttribute("bitstreamSwitching") || "",
        "boolean"
      ),
    };

    // Extract additional dynamic attributes
    const additionalAttrs = this.extractDynamicAttributes(period, [
      "id",
      "start",
      "duration",
      "bitstreamSwitching",
    ]);
    Object.assign(periodData, additionalAttrs);

    // Enhanced Period-level BaseURL with URL resolution using safe query
    const periodBaseUrl = this.safeQuerySelector(period, "BaseURL");
    if (periodBaseUrl) {
      const baseUrlValue = periodBaseUrl.textContent || "";
      periodData.BaseURL = {
        type: "url",
        raw: baseUrlValue,
        resolved: this.resolveUrl(baseUrlValue),
      };
    }

    // AssetIdentifier with safe query
    const assetId = this.safeQuerySelector(period, "AssetIdentifier");
    if (assetId) {
      periodData.AssetIdentifier = {
        schemeIdUri: assetId.getAttribute("schemeIdUri") || "",
        value: assetId.getAttribute("value") || "",
      };
    }

    // EventStream elements with safe query
    const eventStreams = this.safeQuerySelectorAll(period, "EventStream");
    if (eventStreams.length > 0) {
      periodData.EventStream = Array.from(eventStreams).map((es) =>
        this.extractEventStream(es)
      );
    }

    // InbandEventStream elements with safe query
    const inbandEventStreams = this.safeQuerySelectorAll(
      period,
      "InbandEventStream"
    );
    if (inbandEventStreams.length > 0) {
      periodData.InbandEventStream = Array.from(inbandEventStreams).map(
        (ies) => ({
          schemeIdUri: ies.getAttribute("schemeIdUri") || "",
          value: ies.getAttribute("value") || "",
        })
      );
    }

    // Period-level descriptors - return empty arrays instead of null
    periodData.Role = this.extractDescriptors(period, "Role") || [];
    periodData.EssentialProperty =
      this.extractDescriptors(period, "EssentialProperty") || [];
    periodData.SupplementalProperty =
      this.extractDescriptors(period, "SupplementalProperty") || [];

    // AdaptationSet elements with safe query
    const adaptationSets = this.safeQuerySelectorAll(period, "AdaptationSet");
    if (adaptationSets.length > 0) {
      periodData.AdaptationSet = Array.from(adaptationSets).map((as) =>
        this.extractAdaptationSet(as)
      );
    }

    return periodData;
  }

  extractEventStream(eventStream) {
    const es = {
      schemeIdUri: eventStream.getAttribute("schemeIdUri") || "",
      value: eventStream.getAttribute("value") || "",
      timescale: this.convertAttributeValue(
        eventStream.getAttribute("timescale") || "1",
        "numeric"
      ),
    };

    // Event elements within EventStream with proper data typing
    const events = eventStream.querySelectorAll("Event");
    if (events.length > 0) {
      es.Event = Array.from(events).map((event) => ({
        id: event.getAttribute("id") || "",
        presentationTime: this.convertAttributeValue(
          event.getAttribute("presentationTime") || "0",
          "numeric"
        ),
        duration: this.convertAttributeValue(
          event.getAttribute("duration") || "",
          "numeric"
        ),
        messageData: event.textContent || "",
      }));
    }

    return es;
  }

  extractAdaptationSet(adaptationSet) {
    const as = {
      // Core AdaptationSet attributes with proper data typing
      id: this.convertAttributeValue(
        adaptationSet.getAttribute("id") || "",
        "string"
      ),
      group: this.convertAttributeValue(
        adaptationSet.getAttribute("group") || "",
        "numeric"
      ),
      lang: this.convertAttributeValue(
        adaptationSet.getAttribute("lang") || "",
        "string"
      ),
      contentType: this.convertAttributeValue(
        adaptationSet.getAttribute("contentType") || "",
        "string"
      ),
      par: this.convertAttributeValue(
        adaptationSet.getAttribute("par") || "",
        "string"
      ),
      minBandwidth: this.convertAttributeValue(
        adaptationSet.getAttribute("minBandwidth") || "",
        "numeric"
      ),
      maxBandwidth: this.convertAttributeValue(
        adaptationSet.getAttribute("maxBandwidth") || "",
        "numeric"
      ),
      minWidth: this.convertAttributeValue(
        adaptationSet.getAttribute("minWidth") || "",
        "numeric"
      ),
      maxWidth: this.convertAttributeValue(
        adaptationSet.getAttribute("maxWidth") || "",
        "numeric"
      ),
      minHeight: this.convertAttributeValue(
        adaptationSet.getAttribute("minHeight") || "",
        "numeric"
      ),
      maxHeight: this.convertAttributeValue(
        adaptationSet.getAttribute("maxHeight") || "",
        "numeric"
      ),
      minFrameRate: this.convertAttributeValue(
        adaptationSet.getAttribute("minFrameRate") || "",
        "numeric"
      ),
      maxFrameRate: this.convertAttributeValue(
        adaptationSet.getAttribute("maxFrameRate") || "",
        "numeric"
      ),
      segmentAlignment: this.convertAttributeValue(
        adaptationSet.getAttribute("segmentAlignment") || "",
        "boolean"
      ),
      subsegmentAlignment: this.convertAttributeValue(
        adaptationSet.getAttribute("subsegmentAlignment") || "",
        "boolean"
      ),
      subsegmentStartsWithSAP: this.convertAttributeValue(
        adaptationSet.getAttribute("subsegmentStartsWithSAP") || "",
        "numeric"
      ),
      bitstreamSwitching: this.convertAttributeValue(
        adaptationSet.getAttribute("bitstreamSwitching") || "",
        "boolean"
      ),
      mimeType: this.convertAttributeValue(
        adaptationSet.getAttribute("mimeType") || "",
        "string"
      ),
      codecs: this.convertAttributeValue(
        adaptationSet.getAttribute("codecs") || "",
        "string"
      ),
      width: this.convertAttributeValue(
        adaptationSet.getAttribute("width") || "",
        "numeric"
      ),
      height: this.convertAttributeValue(
        adaptationSet.getAttribute("height") || "",
        "numeric"
      ),
      frameRate: this.convertAttributeValue(
        adaptationSet.getAttribute("frameRate") || "",
        "numeric"
      ),
      audioSamplingRate: this.convertAttributeValue(
        adaptationSet.getAttribute("audioSamplingRate") || "",
        "numeric"
      ),
      sar: this.convertAttributeValue(
        adaptationSet.getAttribute("sar") || "",
        "string"
      ),
      startWithSAP: this.convertAttributeValue(
        adaptationSet.getAttribute("startWithSAP") || "",
        "numeric"
      ),
      Label: this.convertAttributeValue(
        adaptationSet.getAttribute("Label") || "",
        "string"
      ),
    };

    // Extract additional dynamic attributes
    const knownAttrs = Object.keys(as);
    const additionalAttrs = this.extractDynamicAttributes(
      adaptationSet,
      knownAttrs
    );
    Object.assign(as, additionalAttrs);

    // Enhanced AdaptationSet-level BaseURL with URL resolution
    const asBaseUrl = adaptationSet.querySelector("BaseURL");
    if (asBaseUrl) {
      const baseUrlValue = asBaseUrl.textContent || "";
      as.BaseURL = {
        type: "url",
        raw: baseUrlValue,
        resolved: this.resolveUrl(baseUrlValue),
      };
    }

    // SegmentTemplate
    const segmentTemplate = adaptationSet.querySelector("SegmentTemplate");
    if (segmentTemplate) {
      as.SegmentTemplate = this.extractSegmentTemplate(segmentTemplate);
    }

    // SegmentList
    const segmentList = adaptationSet.querySelector("SegmentList");
    if (segmentList) {
      as.SegmentList = this.extractSegmentList(segmentList);
    }

    // SegmentBase
    const segmentBase = adaptationSet.querySelector("SegmentBase");
    if (segmentBase) {
      as.SegmentBase = this.extractSegmentBase(segmentBase);
    }

    // Enhanced ContentProtection (DRM) with namespace handling
    const contentProtections =
      adaptationSet.querySelectorAll("ContentProtection");
    if (contentProtections.length > 0) {
      as.ContentProtection = Array.from(contentProtections).map((cp) =>
        this.extractContentProtection(cp)
      );
    }

    // AudioChannelConfiguration
    const audioChannelConfig = adaptationSet.querySelector(
      "AudioChannelConfiguration"
    );
    if (audioChannelConfig) {
      as.AudioChannelConfiguration = {
        schemeIdUri: audioChannelConfig.getAttribute("schemeIdUri") || "",
        value: audioChannelConfig.getAttribute("value") || "",
      };
    }

    // Enhanced descriptors - return empty arrays instead of null
    as.Role = this.extractDescriptors(adaptationSet, "Role") || [];
    as.Accessibility =
      this.extractDescriptors(adaptationSet, "Accessibility") || [];
    as.EssentialProperty =
      this.extractDescriptors(adaptationSet, "EssentialProperty") || [];
    as.SupplementalProperty =
      this.extractDescriptors(adaptationSet, "SupplementalProperty") || [];
    as.Viewpoint = this.extractDescriptors(adaptationSet, "Viewpoint") || [];

    // Representation elements
    const representations = adaptationSet.querySelectorAll("Representation");
    if (representations.length > 0) {
      as.Representation = Array.from(representations).map((rep) =>
        this.extractRepresentation(rep)
      );
    }

    return as;
  }

  extractRepresentation(representation) {
    const rep = {
      // Core Representation attributes with proper data typing
      id: this.convertAttributeValue(
        representation.getAttribute("id") || "",
        "string"
      ),
      bandwidth: this.convertAttributeValue(
        representation.getAttribute("bandwidth") || "",
        "numeric"
      ),
      width: this.convertAttributeValue(
        representation.getAttribute("width") || "",
        "numeric"
      ),
      height: this.convertAttributeValue(
        representation.getAttribute("height") || "",
        "numeric"
      ),
      frameRate: this.convertAttributeValue(
        representation.getAttribute("frameRate") || "",
        "numeric"
      ),
      sar: this.convertAttributeValue(
        representation.getAttribute("sar") || "",
        "string"
      ),
      audioSamplingRate: this.convertAttributeValue(
        representation.getAttribute("audioSamplingRate") || "",
        "numeric"
      ),
      mimeType: this.convertAttributeValue(
        representation.getAttribute("mimeType") || "",
        "string"
      ),
      codecs: this.convertAttributeValue(
        representation.getAttribute("codecs") || "",
        "string"
      ),
      startWithSAP: this.convertAttributeValue(
        representation.getAttribute("startWithSAP") || "",
        "numeric"
      ),
      maxPlayoutRate: this.convertAttributeValue(
        representation.getAttribute("maxPlayoutRate") || "",
        "numeric"
      ),
      codingDependency: this.convertAttributeValue(
        representation.getAttribute("codingDependency") || "",
        "boolean"
      ),
      scanType: this.convertAttributeValue(
        representation.getAttribute("scanType") || "",
        "string"
      ),
    };

    // Extract additional dynamic attributes
    const knownAttrs = Object.keys(rep);
    const additionalAttrs = this.extractDynamicAttributes(
      representation,
      knownAttrs
    );
    Object.assign(rep, additionalAttrs);

    // Enhanced Representation-level BaseURL with URL resolution
    const repBaseUrl = representation.querySelector("BaseURL");
    if (repBaseUrl) {
      const baseUrlValue = repBaseUrl.textContent || "";
      rep.BaseURL = {
        type: "url",
        raw: baseUrlValue,
        resolved: this.resolveUrl(baseUrlValue),
      };
    }

    // SegmentTemplate
    const segmentTemplate = representation.querySelector("SegmentTemplate");
    if (segmentTemplate) {
      rep.SegmentTemplate = this.extractSegmentTemplate(segmentTemplate);
    }

    // SegmentList
    const segmentList = representation.querySelector("SegmentList");
    if (segmentList) {
      rep.SegmentList = this.extractSegmentList(segmentList);
    }

    // SegmentBase
    const segmentBase = representation.querySelector("SegmentBase");
    if (segmentBase) {
      rep.SegmentBase = this.extractSegmentBase(segmentBase);
    }

    // Enhanced ContentProtection at Representation level
    const contentProtections =
      representation.querySelectorAll("ContentProtection");
    if (contentProtections.length > 0) {
      rep.ContentProtection = Array.from(contentProtections).map((cp) =>
        this.extractContentProtection(cp)
      );
    }

    // AudioChannelConfiguration at Representation level
    const audioChannelConfig = representation.querySelector(
      "AudioChannelConfiguration"
    );
    if (audioChannelConfig) {
      rep.AudioChannelConfiguration = {
        schemeIdUri: audioChannelConfig.getAttribute("schemeIdUri") || "",
        value: audioChannelConfig.getAttribute("value") || "",
      };
    }

    // Enhanced Representation-level descriptors - return empty arrays instead of null
    rep.EssentialProperty =
      this.extractDescriptors(representation, "EssentialProperty") || [];
    rep.SupplementalProperty =
      this.extractDescriptors(representation, "SupplementalProperty") || [];

    return rep;
  }

  extractSegmentTemplate(segmentTemplate) {
    const template = {
      // SegmentTemplate attributes with proper data typing
      media: this.convertAttributeValue(
        segmentTemplate.getAttribute("media") || "",
        "url"
      ),
      index: this.convertAttributeValue(
        segmentTemplate.getAttribute("index") || "",
        "url"
      ),
      initialization: this.convertAttributeValue(
        segmentTemplate.getAttribute("initialization") || "",
        "url"
      ),
      bitstreamSwitching: this.convertAttributeValue(
        segmentTemplate.getAttribute("bitstreamSwitching") || "",
        "url"
      ),
      timescale: this.convertAttributeValue(
        segmentTemplate.getAttribute("timescale") || "",
        "numeric"
      ),
      duration: this.convertAttributeValue(
        segmentTemplate.getAttribute("duration") || "",
        "numeric"
      ),
      startNumber: this.convertAttributeValue(
        segmentTemplate.getAttribute("startNumber") || "",
        "numeric"
      ),
      endNumber: this.convertAttributeValue(
        segmentTemplate.getAttribute("endNumber") || "",
        "numeric"
      ),
      presentationTimeOffset: this.convertAttributeValue(
        segmentTemplate.getAttribute("presentationTimeOffset") || "",
        "numeric"
      ),
      indexRange: this.convertAttributeValue(
        segmentTemplate.getAttribute("indexRange") || "",
        "string"
      ),
      indexRangeExact: this.convertAttributeValue(
        segmentTemplate.getAttribute("indexRangeExact") || "",
        "boolean"
      ),
      availabilityTimeOffset: this.convertAttributeValue(
        segmentTemplate.getAttribute("availabilityTimeOffset") || "",
        "duration"
      ),
      availabilityTimeComplete: this.convertAttributeValue(
        segmentTemplate.getAttribute("availabilityTimeComplete") || "",
        "boolean"
      ),
    };

    // Extract additional dynamic attributes
    const knownAttrs = Object.keys(template);
    const additionalAttrs = this.extractDynamicAttributes(
      segmentTemplate,
      knownAttrs
    );
    Object.assign(template, additionalAttrs);

    // SegmentTimeline
    const segmentTimeline = segmentTemplate.querySelector("SegmentTimeline");
    if (segmentTimeline) {
      template.SegmentTimeline = this.extractSegmentTimeline(segmentTimeline);
    }

    return template;
  }

  extractSegmentTimeline(segmentTimeline) {
    const timeline = {};

    // S elements within SegmentTimeline with proper data typing
    const sElements = segmentTimeline.querySelectorAll("S");
    if (sElements.length > 0) {
      timeline.S = Array.from(sElements).map((s) => ({
        t: this.convertAttributeValue(s.getAttribute("t") || "", "numeric"),
        d: this.convertAttributeValue(s.getAttribute("d") || "", "numeric"),
        r: this.convertAttributeValue(s.getAttribute("r") || "", "numeric"),
        n: this.convertAttributeValue(s.getAttribute("n") || "", "numeric"),
      }));
    }

    return timeline;
  }

  extractSegmentList(segmentList) {
    const list = {
      // SegmentList attributes with proper data typing
      duration: this.convertAttributeValue(
        segmentList.getAttribute("duration") || "",
        "numeric"
      ),
      startNumber: this.convertAttributeValue(
        segmentList.getAttribute("startNumber") || "",
        "numeric"
      ),
      timescale: this.convertAttributeValue(
        segmentList.getAttribute("timescale") || "",
        "numeric"
      ),
      presentationTimeOffset: this.convertAttributeValue(
        segmentList.getAttribute("presentationTimeOffset") || "",
        "numeric"
      ),
    };

    // Initialization element
    const initialization = segmentList.querySelector("Initialization");
    if (initialization) {
      list.Initialization = {
        sourceURL: this.convertAttributeValue(
          initialization.getAttribute("sourceURL") || "",
          "url"
        ),
        range: this.convertAttributeValue(
          initialization.getAttribute("range") || "",
          "string"
        ),
      };
    }

    // SegmentURL elements
    const segmentUrls = segmentList.querySelectorAll("SegmentURL");
    if (segmentUrls.length > 0) {
      list.SegmentURL = Array.from(segmentUrls).map((su) => ({
        media: this.convertAttributeValue(
          su.getAttribute("media") || "",
          "url"
        ),
        mediaRange: this.convertAttributeValue(
          su.getAttribute("mediaRange") || "",
          "string"
        ),
        index: this.convertAttributeValue(
          su.getAttribute("index") || "",
          "url"
        ),
        indexRange: this.convertAttributeValue(
          su.getAttribute("indexRange") || "",
          "string"
        ),
      }));
    }

    return list;
  }

  extractSegmentBase(segmentBase) {
    const base = {
      // SegmentBase attributes with proper data typing
      timescale: this.convertAttributeValue(
        segmentBase.getAttribute("timescale") || "",
        "numeric"
      ),
      presentationTimeOffset: this.convertAttributeValue(
        segmentBase.getAttribute("presentationTimeOffset") || "",
        "numeric"
      ),
      indexRange: this.convertAttributeValue(
        segmentBase.getAttribute("indexRange") || "",
        "string"
      ),
      indexRangeExact: this.convertAttributeValue(
        segmentBase.getAttribute("indexRangeExact") || "",
        "boolean"
      ),
      availabilityTimeOffset: this.convertAttributeValue(
        segmentBase.getAttribute("availabilityTimeOffset") || "",
        "duration"
      ),
      availabilityTimeComplete: this.convertAttributeValue(
        segmentBase.getAttribute("availabilityTimeComplete") || "",
        "boolean"
      ),
    };

    // Initialization element
    const initialization = segmentBase.querySelector("Initialization");
    if (initialization) {
      base.Initialization = {
        sourceURL: this.convertAttributeValue(
          initialization.getAttribute("sourceURL") || "",
          "url"
        ),
        range: this.convertAttributeValue(
          initialization.getAttribute("range") || "",
          "string"
        ),
      };
    }

    // RepresentationIndex element
    const representationIndex = segmentBase.querySelector(
      "RepresentationIndex"
    );
    if (representationIndex) {
      base.RepresentationIndex = {
        sourceURL: this.convertAttributeValue(
          representationIndex.getAttribute("sourceURL") || "",
          "url"
        ),
        range: this.convertAttributeValue(
          representationIndex.getAttribute("range") || "",
          "string"
        ),
      };
    }

    return base;
  }

  extractContentProtection(contentProtection) {
    const cp = {
      schemeIdUri: contentProtection.getAttribute("schemeIdUri") || "",
      value: contentProtection.getAttribute("value") || "",
      default_KID:
        contentProtection.getAttribute("cenc:default_KID") ||
        contentProtection.getAttribute("default_KID") ||
        "",
    };

    // Enhanced namespace-aware DRM element extraction
    const drmElements = [
      // PSSH data (Common Encryption)
      { names: ["cenc:pssh", "pssh"], property: "pssh" },
      // Microsoft PlayReady
      { names: ["mspr:pro", "pro", "playready:pro"], property: "mspr" },
      // Widevine
      { names: ["widevine:license", "wv:license"], property: "widevine" },
      // FairPlay
      {
        names: ["fairplay:certificate", "fps:certificate"],
        property: "fairplay",
      },
      // Adobe Access
      { names: ["adobe:metadata", "adbe:metadata"], property: "adobe" },
      // Marlin
      { names: ["marlin:mas", "mrl:mas"], property: "marlin" },
      // ClearKey
      { names: ["clearkey:laurl", "ck:laurl"], property: "clearkey" },
    ];

    drmElements.forEach(({ names, property }) => {
      let element = null;

      // Try each namespace variant
      for (const name of names) {
        element = contentProtection.querySelector(name.replace(":", "\\:"));
        if (element) break;

        // Try without namespace prefix
        const localName = name.split(":").pop();
        element = contentProtection.querySelector(localName);
        if (element) break;

        // Try with wildcard namespace
        element = contentProtection.querySelector(`[*|${localName}]`);
        if (element) break;

        // Try with localName attribute
        element = contentProtection.querySelector(
          `*[localName='${localName}']`
        );
        if (element) break;
      }

      if (element) {
        cp[property] = element.textContent || "";
      }
    });

    // Extract additional DRM attributes dynamically
    const knownAttrs = [
      "schemeIdUri",
      "value",
      "cenc:default_KID",
      "default_KID",
    ];
    const additionalAttrs = this.extractDynamicAttributes(
      contentProtection,
      knownAttrs
    );
    Object.assign(cp, additionalAttrs);

    return cp;
  }

  extractDescriptor(element) {
    return {
      schemeIdUri: element.getAttribute("schemeIdUri") || "",
      value: element.getAttribute("value") || "",
    };
  }

  extractDescriptors(parentElement, tagName) {
    const descriptors = parentElement.querySelectorAll(tagName);
    if (descriptors.length === 0) return []; // Return empty array instead of null

    return Array.from(descriptors).map((desc) => this.extractDescriptor(desc));
  }

  formatManifest(xml) {
    if (!xml) return "";
    return this.prettyPrintXML(xml);
  }

  // Enhanced pretty print XML with better formatting
  prettyPrintXML(xmlDoc) {
    try {
      const serializer = new XMLSerializer();
      const xmlStr = serializer.serializeToString(xmlDoc);

      // Enhanced formatting with better indentation handling
      let formatted = "";
      let indent = "";
      const indentStep = "  ";

      // Split by < and > to handle tags properly
      const parts = xmlStr.split(/(<[^>]*>)/);

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (part.startsWith("<")) {
          // This is a tag
          if (part.startsWith("</")) {
            // Closing tag
            indent = indent.slice(indentStep.length);
            formatted += `${indent}${part}\n`;
          } else if (part.endsWith("/>")) {
            // Self-closing tag
            formatted += `${indent}${part}\n`;
          } else {
            // Opening tag
            formatted += `${indent}${part}\n`;
            if (!part.includes("<?xml") && !part.includes("<!")) {
              indent += indentStep;
            }
          }
        } else if (part.trim()) {
          // Text content
          const trimmedContent = part.trim();
          if (trimmedContent) {
            formatted += `${indent}${trimmedContent}\n`;
          }
        }
      }

      return formatted;
    } catch (error) {
      console.warn("XML formatting failed, returning original:", error);
      // Fallback to original method
      return this.fallbackPrettyPrint(xmlDoc);
    }
  }

  // Fallback pretty print method (original implementation)
  fallbackPrettyPrint(xmlDoc) {
    const serializer = new XMLSerializer();
    const xmlStr = serializer.serializeToString(xmlDoc);
    let formatted = "";
    let indent = "";
    const indentStep = "  ";

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

  // Enhanced semantic validation for interdependencies
  performSemanticValidation(mpdData, xml) {
    const validation = {
      warnings: [],
      errors: [],
      interdependencies: {},
    };

    try {
      // Validate period continuity
      this.validatePeriodContinuity(mpdData, validation);

      // Validate timing interdependencies
      this.validateTimingInterdependencies(mpdData, validation);

      // Validate multiple BaseURL conflicts
      this.validateBaseURLConflicts(mpdData, xml, validation);

      // Validate live stream consistency
      this.validateLiveStreamConsistency(mpdData, validation);

      // Add parent reference tracking
      this.addParentReferences(mpdData);
    } catch (error) {
      validation.errors.push({
        type: "SEMANTIC_VALIDATION_ERROR",
        message: `Semantic validation failed: ${error.message}`,
        severity: "MEDIUM",
      });
    }

    return validation;
  }

  // Validate period continuity (start + duration)
  validatePeriodContinuity(mpdData, validation) {
    const periods = mpdData.Period || [];
    if (periods.length === 0) return;

    let expectedStart = 0;
    let totalDuration = 0;

    periods.forEach((period, index) => {
      const startTime = period.start?.parsed || 0;
      const duration = period.duration?.parsed;

      // Check period start time continuity
      if (index > 0 && Math.abs(startTime - expectedStart) > 0.1) {
        validation.warnings.push({
          type: "PERIOD_CONTINUITY_GAP",
          message: `Period ${index} start time (${startTime}s) doesn't align with expected (${expectedStart}s)`,
          periodIndex: index,
          gap: Math.abs(startTime - expectedStart),
          severity: "MEDIUM",
        });
      }

      if (duration) {
        totalDuration += duration;
        expectedStart = startTime + duration;
      }
    });

    // Validate against MPD duration
    const mpdDuration = mpdData.mediaPresentationDuration?.parsed;
    if (mpdDuration && Math.abs(totalDuration - mpdDuration) > 1.0) {
      validation.warnings.push({
        type: "MPD_DURATION_MISMATCH",
        message: `Sum of period durations (${totalDuration}s) doesn't match MPD duration (${mpdDuration}s)`,
        difference: Math.abs(totalDuration - mpdDuration),
        severity: "HIGH",
      });
    }

    validation.interdependencies.periodContinuity = {
      totalDuration,
      expectedDuration: mpdDuration,
      continuityGaps: validation.warnings.filter(
        (w) => w.type === "PERIOD_CONTINUITY_GAP"
      ).length,
    };
  }

  // Validate timing interdependencies
  validateTimingInterdependencies(mpdData, validation) {
    const minBufferTime = mpdData.minBufferTime?.parsed;
    const timeShiftBufferDepth = mpdData.timeShiftBufferDepth?.parsed;
    const suggestedPresentationDelay =
      mpdData.suggestedPresentationDelay?.parsed;
    const minimumUpdatePeriod = mpdData.minimumUpdatePeriod?.parsed;

    // Check buffer time relationships
    if (minBufferTime && suggestedPresentationDelay) {
      if (suggestedPresentationDelay < minBufferTime) {
        validation.warnings.push({
          type: "BUFFER_TIME_CONFLICT",
          message: `suggestedPresentationDelay (${suggestedPresentationDelay}s) is less than minBufferTime (${minBufferTime}s)`,
          severity: "HIGH",
        });
      }
    }

    // Check live stream timing consistency
    if (mpdData.type?.parsed === "dynamic") {
      if (timeShiftBufferDepth && minimumUpdatePeriod) {
        if (timeShiftBufferDepth < minimumUpdatePeriod * 2) {
          validation.warnings.push({
            type: "LIVE_TIMING_CONFLICT",
            message: `timeShiftBufferDepth (${timeShiftBufferDepth}s) should be at least 2x minimumUpdatePeriod (${minimumUpdatePeriod}s)`,
            severity: "MEDIUM",
          });
        }
      }
    }

    validation.interdependencies.timing = {
      minBufferTime,
      timeShiftBufferDepth,
      suggestedPresentationDelay,
      minimumUpdatePeriod,
      isLive: mpdData.type?.parsed === "dynamic",
    };
  }

  // Validate multiple BaseURL conflicts
  validateBaseURLConflicts(mpdData, xml, validation) {
    const baseUrls = [];

    // Collect all BaseURLs from different levels
    const mpdBaseUrl = xml.querySelector("MPD > BaseURL");
    if (mpdBaseUrl) {
      baseUrls.push({
        level: "MPD",
        url: mpdBaseUrl.textContent,
        element: mpdBaseUrl,
      });
    }

    const periods = xml.querySelectorAll("Period");
    periods.forEach((period, pIndex) => {
      const periodBaseUrl = period.querySelector("BaseURL");
      if (periodBaseUrl) {
        baseUrls.push({
          level: `Period[${pIndex}]`,
          url: periodBaseUrl.textContent,
          element: periodBaseUrl,
        });
      }

      const adaptationSets = period.querySelectorAll("AdaptationSet");
      adaptationSets.forEach((as, asIndex) => {
        const asBaseUrl = as.querySelector("BaseURL");
        if (asBaseUrl) {
          baseUrls.push({
            level: `Period[${pIndex}].AdaptationSet[${asIndex}]`,
            url: asBaseUrl.textContent,
            element: asBaseUrl,
          });
        }

        const representations = as.querySelectorAll("Representation");
        representations.forEach((rep, repIndex) => {
          const repBaseUrl = rep.querySelector("BaseURL");
          if (repBaseUrl) {
            baseUrls.push({
              level: `Period[${pIndex}].AdaptationSet[${asIndex}].Representation[${repIndex}]`,
              url: repBaseUrl.textContent,
              element: repBaseUrl,
            });
          }
        });
      });
    });

    // Check for conflicts
    const urlMap = new Map();
    baseUrls.forEach(({ level, url }) => {
      if (urlMap.has(url)) {
        validation.warnings.push({
          type: "BASEURL_CONFLICT",
          message: `Duplicate BaseURL "${url}" found at ${level} and ${urlMap.get(
            url
          )}`,
          severity: "LOW",
        });
      } else {
        urlMap.set(url, level);
      }
    });

    validation.interdependencies.baseUrls = baseUrls;
  }

  // Validate live stream consistency
  validateLiveStreamConsistency(mpdData, validation) {
    const isLive = mpdData.type?.parsed === "dynamic";
    const requiredLiveAttrs = ["availabilityStartTime", "minimumUpdatePeriod"];
    const recommendedLiveAttrs = [
      "timeShiftBufferDepth",
      "suggestedPresentationDelay",
    ];

    if (isLive) {
      requiredLiveAttrs.forEach((attr) => {
        if (!mpdData[attr] || !mpdData[attr].parsed) {
          validation.errors.push({
            type: "MISSING_LIVE_ATTRIBUTE",
            message: `Required live stream attribute "${attr}" is missing or invalid`,
            attribute: attr,
            severity: "HIGH",
          });
        }
      });

      recommendedLiveAttrs.forEach((attr) => {
        if (!mpdData[attr] || !mpdData[attr].parsed) {
          validation.warnings.push({
            type: "MISSING_RECOMMENDED_LIVE_ATTRIBUTE",
            message: `Recommended live stream attribute "${attr}" is missing`,
            attribute: attr,
            severity: "MEDIUM",
          });
        }
      });
    }

    validation.interdependencies.liveConsistency = {
      isLive,
      hasRequiredAttrs: isLive
        ? requiredLiveAttrs.every((attr) => mpdData[attr]?.parsed)
        : true,
    };
  }

  // Add parent reference tracking for better comparison
  addParentReferences(mpdData) {
    if (mpdData.Period) {
      mpdData.Period.forEach((period, pIndex) => {
        period._parentRef = { type: "MPD", index: -1 };
        period._index = pIndex;

        if (period.AdaptationSet) {
          period.AdaptationSet.forEach((as, asIndex) => {
            as._parentRef = { type: "Period", index: pIndex };
            as._index = asIndex;

            if (as.Representation) {
              as.Representation.forEach((rep, repIndex) => {
                rep._parentRef = {
                  type: "AdaptationSet",
                  index: asIndex,
                  periodIndex: pIndex,
                };
                rep._index = repIndex;
              });
            }
          });
        }
      });
    }
  }

  // Enhanced edge-case handling for malformed XML
  safeQuerySelector(element, selector, fallbackSelectors = []) {
    try {
      let result = element.querySelector(selector);
      if (result) return result;

      // Try fallback selectors
      for (const fallback of fallbackSelectors) {
        result = element.querySelector(fallback);
        if (result) return result;
      }

      return null;
    } catch (error) {
      console.warn(`Query selector failed for "${selector}":`, error);
      return null;
    }
  }

  // Enhanced edge-case handling for malformed XML
  safeQuerySelectorAll(element, selector, fallbackSelectors = []) {
    try {
      let results = element.querySelectorAll(selector);
      if (results.length > 0) return results;

      // Try fallback selectors
      for (const fallback of fallbackSelectors) {
        results = element.querySelectorAll(fallback);
        if (results.length > 0) return results;
      }

      return [];
    } catch (error) {
      console.warn(`Query selector all failed for "${selector}":`, error);
      return [];
    }
  }

  // Performance optimization for large MPDs
  optimizedPrettyPrint(xmlDoc, maxSize = 1024 * 1024) {
    // 1MB limit
    try {
      const serializer = new XMLSerializer();
      const xmlStr = serializer.serializeToString(xmlDoc);

      // For large manifests, use simplified formatting
      if (xmlStr.length > maxSize) {
        console.warn("Large manifest detected, using simplified formatting");
        return xmlStr.replace(/></g, ">\n<");
      }

      return this.prettyPrintXML(xmlDoc);
    } catch (error) {
      console.warn("Optimized pretty print failed:", error);
      return xmlDoc.toString();
    }
  }
}
