import SSAIMPDValidator from '../logic/validation.js';

export class ManifestComparison {
  constructor() {
    this.validator = SSAIMPDValidator;
    // Configuration for robust comparison
    this.config = {
      timingTolerance: 0.001, // 1ms tolerance for timing comparisons
      attributeTolerance: {
        bandwidth: 0.01, // 1% tolerance for bandwidth
        duration: 0.001, // 1ms tolerance for durations
        frameRate: 0.01 // 1% tolerance for frame rates
      },
      defaultTimescales: {
        video: 90000,
        audio: 48000,
        text: 1000
      },
      semanticMatching: true, // Use semantic matching instead of index-based
      cumulativeDriftThreshold: 0.1 // 100ms cumulative drift threshold
    };
  }

  compareManifests(sourceManifest, ssaiManifest) {
    if (!sourceManifest || !ssaiManifest) return [];

    // Enhanced comparison with robust matching
    const enhancedComparison = this.performEnhancedComparison(sourceManifest, ssaiManifest);
    
    // Run comprehensive validation
    const comprehensiveValidation = this.performComprehensiveValidation(sourceManifest, ssaiManifest);
    
    // Combine results with deduplication
    return this.combineValidationResults(enhancedComparison, comprehensiveValidation);
  }

  async combineValidationResults(enhancedResults, comprehensivePromise) {
    try {
      const comprehensiveResults = await comprehensivePromise;
      
      // Create a map for efficient deduplication
      const issueMap = new Map();
      
      // Add enhanced results first
      enhancedResults.forEach(result => {
        const key = this.generateIssueKey(result);
        if (!issueMap.has(key)) {
          issueMap.set(key, result);
        }
      });
      
      // Add comprehensive results, avoiding duplicates
      comprehensiveResults.forEach(compResult => {
        const key = this.generateIssueKey(compResult);
        if (!issueMap.has(key)) {
          issueMap.set(key, compResult);
        } else {
          // Merge additional information if available
          const existing = issueMap.get(key);
          if (compResult.impact && !existing.impact) {
            existing.impact = compResult.impact;
          }
          if (compResult.solution && existing.solution.length < compResult.solution.length) {
            existing.solution = compResult.solution;
          }
        }
      });
      
      return Array.from(issueMap.values());
    } catch (error) {
      console.warn('Comprehensive validation failed, using enhanced comparison only:', error);
      return enhancedResults;
    }
  }

  generateIssueKey(issue) {
    // Generate a unique key for deduplication based on issue characteristics
    return `${issue.type}_${issue.tag}_${issue.attribute}_${issue.message}`.toLowerCase();
  }

  performEnhancedComparison(sourceManifest, ssaiManifest) {
    const differences = [];
    
    try {
      // Parse manifests to structured objects
      const sourceMPD = this.parseManifestToObject(sourceManifest);
      const ssaiMPD = this.parseManifestToObject(ssaiManifest);
      
      // 1. Fix: Semantic element matching instead of index-based
      differences.push(...this.compareElementsSemanticaly(sourceMPD, ssaiMPD));
      
      // 2. Fix: Comprehensive nested structure validation
      differences.push(...this.validateNestedStructures(sourceMPD, ssaiMPD));
      
      // 3. Fix: Robust timescale handling
      differences.push(...this.validateTimescaleConsistency(sourceMPD, ssaiMPD));
      
      // 4. Fix: Dynamic/live MPD support
      differences.push(...this.validateDynamicMPDFeatures(sourceMPD, ssaiMPD));
      
      // 5. Fix: Cumulative drift detection
      differences.push(...this.detectCumulativeDrift(sourceMPD, ssaiMPD));
      
      // 6. Fix: Attribute tolerance for false positives
      differences.push(...this.compareAttributesWithTolerance(sourceMPD, ssaiMPD));
      
    } catch (error) {
      differences.push({
        type: 'ERROR',
        tag: 'Enhanced Comparison',
        attribute: '',
        sourceValue: '',
        ssaiValue: '',
        solution: 'Check manifest format and structure',
        severity: 'HIGH',
        message: `Enhanced comparison failed: ${error.message}`
      });
    }
    
    return differences;
  }

  compareElementsSemanticaly(sourceMPD, ssaiMPD) {
    const differences = [];
    
    // Compare periods using semantic matching
    const sourcePeriods = this.ensureArray(sourceMPD.Period);
    const ssaiPeriods = this.ensureArray(ssaiMPD.Period);
    
    // Create semantic maps for periods
    const sourcePeriodsMap = this.createPeriodSemanticMap(sourcePeriods);
    const ssaiPeriodsMap = this.createPeriodSemanticMap(ssaiPeriods);
    
    // Check for missing periods
    Object.keys(sourcePeriodsMap).forEach(semanticKey => {
      if (!ssaiPeriodsMap[semanticKey]) {
        differences.push({
          type: 'MISSING_PERIOD',
          tag: `Period (${semanticKey})`,
          attribute: '',
          sourceValue: 'Present',
          ssaiValue: 'Missing',
          solution: 'Add missing period to SSAI manifest or verify if removal is intentional for ad insertion',
          severity: 'HIGH',
          message: `Period with semantic key "${semanticKey}" missing in SSAI manifest`
        });
      }
    });
    
    // Compare adaptation sets within matching periods
    Object.keys(sourcePeriodsMap).forEach(semanticKey => {
      const sourcePeriod = sourcePeriodsMap[semanticKey];
      const ssaiPeriod = ssaiPeriodsMap[semanticKey];
      
      if (sourcePeriod && ssaiPeriod) {
        differences.push(...this.compareAdaptationSetsSemanticaly(
          sourcePeriod, ssaiPeriod, semanticKey
        ));
      }
    });
    
    return differences;
  }

  createPeriodSemanticMap(periods) {
    const map = {};
    periods.forEach((period, index) => {
      // Create semantic key based on period characteristics
      const start = period.start || `index_${index}`;
      const duration = period.duration || 'unknown';
      
      // Use multiple fallback strategies for matching
      const semanticKey = period.id || `${start}_${duration}` || `index_${index}`;
      map[semanticKey] = period;
    });
    return map;
  }

  compareAdaptationSetsSemanticaly(sourcePeriod, ssaiPeriod, periodKey) {
    const differences = [];
    
    const sourceAS = this.ensureArray(sourcePeriod.AdaptationSet);
    const ssaiAS = this.ensureArray(ssaiPeriod.AdaptationSet);
    
    // Create semantic maps for adaptation sets
    const sourceASMap = this.createAdaptationSetSemanticMap(sourceAS);
    const ssaiASMap = this.createAdaptationSetSemanticMap(ssaiAS);
    
    // Check for missing adaptation sets
    Object.keys(sourceASMap).forEach(semanticKey => {
      if (!ssaiASMap[semanticKey]) {
        differences.push({
          type: 'MISSING_ADAPTATION_SET',
          tag: `AdaptationSet (${periodKey}:${semanticKey})`,
          attribute: '',
          sourceValue: 'Present',
          ssaiValue: 'Missing',
          solution: 'Add missing adaptation set to SSAI manifest',
          severity: 'VERY_HIGH',
          message: `AdaptationSet "${semanticKey}" missing in period "${periodKey}"`
        });
      }
    });
    
    return differences;
  }

  createAdaptationSetSemanticMap(adaptationSets) {
    const map = {};
    adaptationSets.forEach((as) => {
      // Create semantic key based on content characteristics
      const contentType = as.contentType || this.inferContentType(as.mimeType);
      const lang = as.lang || 'und';
      const role = this.extractRole(as.Role) || 'main';
      const codecs = this.normalizeCodecs(as.codecs) || 'unknown';
      
      const semanticKey = `${contentType}_${lang}_${role}_${codecs}`;
      map[semanticKey] = as;
    });
    return map;
  }

  validateNestedStructures(sourceMPD, ssaiMPD) {
    const differences = [];
    
    // Validate per-representation SegmentTemplates
    const sourcePeriods = this.ensureArray(sourceMPD.Period);
    const ssaiPeriods = this.ensureArray(ssaiMPD.Period);
    
    sourcePeriods.forEach((sourcePeriod, periodIndex) => {
      const ssaiPeriod = ssaiPeriods[periodIndex];
      if (!ssaiPeriod) return;
      
      const sourceAS = this.ensureArray(sourcePeriod.AdaptationSet);
      const ssaiAS = this.ensureArray(ssaiPeriod.AdaptationSet);
      
      sourceAS.forEach((srcAS, asIndex) => {
        const ssaiASMatch = ssaiAS[asIndex];
        if (!ssaiASMatch) return;
        
        // Check adaptation set level SegmentTemplate
        if (srcAS.SegmentTemplate && ssaiASMatch.SegmentTemplate) {
          differences.push(...this.validateSegmentTemplate(
            srcAS.SegmentTemplate, 
            ssaiASMatch.SegmentTemplate,
            `Period[${periodIndex}].AdaptationSet[${asIndex}]`
          ));
        }
        
        // Check per-representation SegmentTemplates
        const sourceReps = this.ensureArray(srcAS.Representation);
        const ssaiReps = this.ensureArray(ssaiASMatch.Representation);
        
        sourceReps.forEach((srcRep, repIndex) => {
          const ssaiRep = ssaiReps[repIndex];
          if (!ssaiRep) return;
          
          if (srcRep.SegmentTemplate && ssaiRep.SegmentTemplate) {
            differences.push(...this.validateSegmentTemplate(
              srcRep.SegmentTemplate,
              ssaiRep.SegmentTemplate,
              `Period[${periodIndex}].AdaptationSet[${asIndex}].Representation[${repIndex}]`
            ));
          }
        });
      });
    });
    
    return differences;
  }

  validateSegmentTemplate(sourceTemplate, ssaiTemplate, context) {
    const differences = [];
    
    // Validate timescale consistency
    const srcTimescale = sourceTemplate.timescale || this.getDefaultTimescale(context);
    const ssaiTimescale = ssaiTemplate.timescale || this.getDefaultTimescale(context);
    
    if (srcTimescale !== ssaiTimescale) {
      differences.push({
        type: 'TIMESCALE_MISMATCH',
        tag: `SegmentTemplate (${context})`,
        attribute: 'timescale',
        sourceValue: srcTimescale.toString(),
        ssaiValue: ssaiTimescale.toString(),
        solution: 'Ensure timescale values match between source and SSAI manifests',
        severity: 'VERY_HIGH',
        message: `Timescale mismatch in ${context}: source=${srcTimescale}, ssai=${ssaiTimescale}`
      });
    }
    
    // Validate multiple timelines if present
    if (sourceTemplate.SegmentTimeline && ssaiTemplate.SegmentTimeline) {
      differences.push(...this.validateMultipleTimelines(
        sourceTemplate.SegmentTimeline,
        ssaiTemplate.SegmentTimeline,
        srcTimescale,
        ssaiTimescale,
        context
      ));
    }
    
    return differences;
  }

  validateTimescaleConsistency(sourceMPD, ssaiMPD) {
    const differences = [];
    
    // Collect all timescales from the manifest
    const sourceTimescales = this.collectAllTimescales(sourceMPD);
    const ssaiTimescales = this.collectAllTimescales(ssaiMPD);
    
    // Check for inconsistent defaults
    Object.keys(sourceTimescales).forEach(context => {
      const sourceValue = sourceTimescales[context];
      const ssaiValue = ssaiTimescales[context];
      
      if (sourceValue && ssaiValue && sourceValue !== ssaiValue) {
        differences.push({
          type: 'TIMESCALE_INCONSISTENCY',
          tag: `Timescale (${context})`,
          attribute: 'timescale',
          sourceValue: sourceValue.toString(),
          ssaiValue: ssaiValue.toString(),
          solution: 'Standardize timescale values across all segment templates',
          severity: 'HIGH',
          message: `Inconsistent timescale in ${context}`
        });
      }
    });
    
    return differences;
  }

  validateDynamicMPDFeatures(sourceMPD, ssaiMPD) {
    const differences = [];
    
    // Check if this is a dynamic MPD
    if (sourceMPD.type === 'dynamic' || ssaiMPD.type === 'dynamic') {
      
      // Validate live-specific attributes
      const liveAttributes = [
        'availabilityStartTime',
        'minimumUpdatePeriod',
        'timeShiftBufferDepth',
        'suggestedPresentationDelay'
      ];
      
      liveAttributes.forEach(attr => {
        if (sourceMPD[attr] && !ssaiMPD[attr]) {
          differences.push({
            type: 'MISSING_LIVE_ATTRIBUTE',
            tag: 'MPD',
            attribute: attr,
            sourceValue: sourceMPD[attr],
            ssaiValue: 'Missing',
            solution: `Add ${attr} to SSAI manifest for proper live streaming support`,
            severity: 'VERY_HIGH',
            message: `Missing live streaming attribute: ${attr}`
          });
        }
      });
      
      // Validate UTCTiming for live streams
      if (!ssaiMPD.UTCTiming && sourceMPD.type === 'dynamic') {
        differences.push({
          type: 'MISSING_UTC_TIMING',
          tag: 'MPD',
          attribute: 'UTCTiming',
          sourceValue: 'Present',
          ssaiValue: 'Missing',
          solution: 'Add UTCTiming element for clock synchronization in live streams',
          severity: 'VERY_HIGH',
          message: 'UTCTiming missing for dynamic MPD - required for live streaming'
        });
      }
      
      // Validate segment availability windows
      differences.push(...this.validateSegmentAvailability(sourceMPD, ssaiMPD));
    }
    
    return differences;
  }

  detectCumulativeDrift(sourceMPD, ssaiMPD) {
    const differences = [];
    
    try {
      const sourcePeriods = this.ensureArray(sourceMPD.Period);
      const ssaiPeriods = this.ensureArray(ssaiMPD.Period);
      
      let cumulativeDrift = 0;
      let sourceTime = 0;
      let ssaiTime = 0;
      
      // Calculate cumulative timing drift across periods
      for (let i = 0; i < Math.min(sourcePeriods.length, ssaiPeriods.length); i++) {
        const sourcePeriod = sourcePeriods[i];
        const ssaiPeriod = ssaiPeriods[i];
        
        // Parse period start times
        const sourceStart = this.parseDurationToSeconds(sourcePeriod.start) || sourceTime;
        const ssaiStart = this.parseDurationToSeconds(ssaiPeriod.start) || ssaiTime;
        
        // Calculate drift for this period
        const periodDrift = Math.abs(sourceStart - ssaiStart);
        cumulativeDrift += periodDrift;
        
        // Update running times
        const sourceDuration = this.parseDurationToSeconds(sourcePeriod.duration) || 0;
        const ssaiDuration = this.parseDurationToSeconds(ssaiPeriod.duration) || 0;
        
        sourceTime = sourceStart + sourceDuration;
        ssaiTime = ssaiStart + ssaiDuration;
        
        // Check if cumulative drift exceeds threshold
        if (cumulativeDrift > this.config.cumulativeDriftThreshold) {
          differences.push({
            type: 'CUMULATIVE_DRIFT',
            tag: `Timeline Drift (Period ${i})`,
            attribute: 'timing',
            sourceValue: `${sourceTime.toFixed(3)}s`,
            ssaiValue: `${ssaiTime.toFixed(3)}s`,
            solution: 'Review timing alignment across all periods to prevent cumulative drift',
            severity: 'HIGH',
            message: `Cumulative timing drift of ${cumulativeDrift.toFixed(3)}s detected at period ${i}`
          });
          break; // Report only the first significant drift
        }
      }
      
    } catch (error) {
      // Don't fail the entire comparison if drift detection fails
      console.warn('Cumulative drift detection failed:', error);
    }
    
    return differences;
  }

  compareAttributesWithTolerance(sourceMPD, ssaiMPD) {
    const differences = [];
    
    // Compare numeric attributes with tolerance
    const numericComparisons = [
      { path: 'minBufferTime', tolerance: 'duration' },
      { path: 'mediaPresentationDuration', tolerance: 'duration' },
      { path: 'timeShiftBufferDepth', tolerance: 'duration' }
    ];
    
    numericComparisons.forEach(({ path, tolerance }) => {
      const sourceValue = this.getNestedValue(sourceMPD, path);
      const ssaiValue = this.getNestedValue(ssaiMPD, path);
      
      if (sourceValue && ssaiValue) {
        const srcSeconds = this.parseDurationToSeconds(sourceValue);
        const ssaiSeconds = this.parseDurationToSeconds(ssaiValue);
        
        if (srcSeconds !== null && ssaiSeconds !== null) {
          const toleranceValue = this.config.attributeTolerance[tolerance] || 0.001;
          const diff = Math.abs(srcSeconds - ssaiSeconds);
          
          if (diff > toleranceValue && diff > srcSeconds * 0.01) { // 1% or absolute tolerance
            differences.push({
              type: 'ATTRIBUTE_TOLERANCE_EXCEEDED',
              tag: 'MPD',
              attribute: path,
              sourceValue: `${srcSeconds.toFixed(3)}s`,
              ssaiValue: `${ssaiSeconds.toFixed(3)}s`,
              solution: `Adjust ${path} in SSAI manifest to be within tolerance of source value`,
              severity: 'MEDIUM',
              message: `${path} difference (${diff.toFixed(3)}s) exceeds tolerance`
            });
          }
        }
      }
    });
    
    return differences;
  }

  async performComprehensiveValidation(sourceManifest, ssaiManifest) {
    try {
      // Parse XML manifests to objects for comprehensive validation
      const sourceMPD = this.parseManifestToObject(sourceManifest);
      const ssaiMPD = this.parseManifestToObject(ssaiManifest);
      
      const validationResults = await this.validator.validate(sourceMPD, ssaiMPD);
      
      // Convert validation results to the expected format for the UI
      const differences = [];

      // Process errors
      validationResults.errors.forEach(error => {
        differences.push({
          type: this.mapSeverityToType(error.severity),
          tag: error.rule || error.periodId || 'MPD',
          attribute: error.attribute || '',
          sourceValue: error.expected || '',
          ssaiValue: error.actual || '',
          solution: this.generateSolution(error),
          severity: error.severity,
          message: error.message,
          impact: error.impact
        });
      });

      // Process warnings
      validationResults.warnings.forEach(warning => {
        differences.push({
          type: this.mapSeverityToType(warning.severity),
          tag: warning.rule || warning.periodId || 'MPD',
          attribute: warning.attribute || '',
          sourceValue: warning.expected || '',
          ssaiValue: warning.actual || '',
          solution: this.generateSolution(warning),
          severity: warning.severity,
          message: warning.message,
          impact: warning.impact
        });
      });

      // Add summary information
      if (validationResults.summary) {
        differences.unshift({
          type: 'SUMMARY',
          tag: 'Validation Summary',
          attribute: '',
          sourceValue: `Total Issues: ${validationResults.summary.totalIssues}`,
          ssaiValue: `Critical: ${validationResults.summary.criticalIssues}`,
          solution: validationResults.summary.isValid 
            ? 'SSAI manifest is valid for playback' 
            : 'Review and fix critical issues before deployment',
          severity: validationResults.summary.isValid ? 'INFO' : 'VERY_HIGH',
          message: `Validation completed. Ad periods detected: ${validationResults.summary.adPeriodsDetected}`,
          summary: validationResults.summary
        });
      }

      return differences;
    } catch (error) {
      console.error('Comprehensive validation error:', error);
      return [{
        type: 'ERROR',
        tag: 'Comprehensive Validation',
        attribute: '',
        sourceValue: '',
        ssaiValue: '',
        solution: 'Check manifest format and try again',
        severity: 'MEDIUM',
        message: `Comprehensive validation failed: ${error.message}`
      }];
    }
  }

  parseManifestToObject(xmlDoc) {
    const mpd = xmlDoc.querySelector('MPD');
    if (!mpd) return {};

    const mpdObj = {
      // Root attributes
      type: mpd.getAttribute('type'),
      mediaPresentationDuration: mpd.getAttribute('mediaPresentationDuration'),
      minBufferTime: mpd.getAttribute('minBufferTime'),
      profiles: mpd.getAttribute('profiles'),
      availabilityStartTime: mpd.getAttribute('availabilityStartTime'),
      publishTime: mpd.getAttribute('publishTime'),
      minimumUpdatePeriod: mpd.getAttribute('minimumUpdatePeriod'),
      timeShiftBufferDepth: mpd.getAttribute('timeShiftBufferDepth'),
      suggestedPresentationDelay: mpd.getAttribute('suggestedPresentationDelay'),
      maxSegmentDuration: mpd.getAttribute('maxSegmentDuration')
    };

    // Parse BaseURL
    const baseURL = xmlDoc.querySelector('BaseURL');
    if (baseURL) {
      mpdObj.BaseURL = baseURL.textContent;
    }

    // Parse Location elements
    const locations = xmlDoc.querySelectorAll('Location');
    if (locations.length > 0) {
      mpdObj.Location = Array.from(locations).map(loc => loc.textContent);
    }

    // Parse PatchLocation elements
    const patchLocations = xmlDoc.querySelectorAll('PatchLocation');
    if (patchLocations.length > 0) {
      mpdObj.PatchLocation = Array.from(patchLocations).map(loc => loc.textContent);
    }

    // Parse UTCTiming
    const utcTiming = xmlDoc.querySelector('UTCTiming');
    if (utcTiming) {
      mpdObj.UTCTiming = {
        schemeIdUri: utcTiming.getAttribute('schemeIdUri'),
        value: utcTiming.getAttribute('value')
      };
    }

    // Parse ServiceDescription
    const serviceDesc = xmlDoc.querySelector('ServiceDescription');
    if (serviceDesc) {
      mpdObj.ServiceDescription = this.parseServiceDescription(serviceDesc);
    }

    // Parse Periods
    const periods = xmlDoc.querySelectorAll('Period');
    if (periods.length > 0) {
      mpdObj.Period = Array.from(periods).map(period => this.parsePeriod(period));
    }

    return mpdObj;
  }

  parseServiceDescription(serviceDesc) {
    const service = {};
    
    const latency = serviceDesc.querySelector('Latency');
    if (latency) {
      service.Latency = {
        target: parseInt(latency.getAttribute('target')),
        max: parseInt(latency.getAttribute('max')),
        min: parseInt(latency.getAttribute('min'))
      };
    }

    const playbackRate = serviceDesc.querySelector('PlaybackRate');
    if (playbackRate) {
      service.PlaybackRate = {
        max: parseFloat(playbackRate.getAttribute('max')),
        min: parseFloat(playbackRate.getAttribute('min'))
      };
    }

    return service;
  }

  parsePeriod(period) {
    const periodObj = {
      id: period.getAttribute('id'),
      start: period.getAttribute('start'),
      duration: period.getAttribute('duration')
    };

    // Parse AssetIdentifier
    const assetId = period.querySelector('AssetIdentifier');
    if (assetId) {
      periodObj.AssetIdentifier = {
        schemeIdUri: assetId.getAttribute('schemeIdUri'),
        value: assetId.getAttribute('value')
      };
    }

    // Parse EventStreams
    const eventStreams = period.querySelectorAll('EventStream');
    if (eventStreams.length > 0) {
      periodObj.EventStream = Array.from(eventStreams).map(es => this.parseEventStream(es));
    }

    // Parse InbandEventStreams
    const inbandEventStreams = period.querySelectorAll('InbandEventStream');
    if (inbandEventStreams.length > 0) {
      periodObj.InbandEventStream = Array.from(inbandEventStreams).map(ies => ({
        schemeIdUri: ies.getAttribute('schemeIdUri'),
        value: ies.getAttribute('value')
      }));
    }

    // Parse AdaptationSets
    const adaptationSets = period.querySelectorAll('AdaptationSet');
    if (adaptationSets.length > 0) {
      periodObj.AdaptationSet = Array.from(adaptationSets).map(as => this.parseAdaptationSet(as));
    }

    // Parse Roles, EssentialProperty, SupplementalProperty
    periodObj.Role = this.parseDescriptors(period, 'Role');
    periodObj.EssentialProperty = this.parseDescriptors(period, 'EssentialProperty');
    periodObj.SupplementalProperty = this.parseDescriptors(period, 'SupplementalProperty');

    return periodObj;
  }

  parseEventStream(eventStream) {
    const es = {
      schemeIdUri: eventStream.getAttribute('schemeIdUri'),
      value: eventStream.getAttribute('value'),
      timescale: parseInt(eventStream.getAttribute('timescale')) || 1
    };

    const events = eventStream.querySelectorAll('Event');
    if (events.length > 0) {
      es.Event = Array.from(events).map(event => ({
        id: event.getAttribute('id'),
        presentationTime: parseInt(event.getAttribute('presentationTime')) || 0,
        duration: parseInt(event.getAttribute('duration')),
        messageData: event.textContent
      }));
    }

    return es;
  }

  parseAdaptationSet(adaptationSet) {
    const as = {
      id: adaptationSet.getAttribute('id'),
      mimeType: adaptationSet.getAttribute('mimeType'),
      codecs: adaptationSet.getAttribute('codecs'),
      contentType: adaptationSet.getAttribute('contentType'),
      lang: adaptationSet.getAttribute('lang'),
      segmentAlignment: adaptationSet.getAttribute('segmentAlignment') === 'true',
      Label: adaptationSet.getAttribute('Label')
    };

    // Parse AudioChannelConfiguration
    const audioChannel = adaptationSet.querySelector('AudioChannelConfiguration');
    if (audioChannel) {
      as.AudioChannelConfiguration = {
        schemeIdUri: audioChannel.getAttribute('schemeIdUri'),
        value: audioChannel.getAttribute('value')
      };
    }

    // Parse ContentProtection
    const contentProtections = adaptationSet.querySelectorAll('ContentProtection');
    if (contentProtections.length > 0) {
      as.ContentProtection = Array.from(contentProtections).map(cp => ({
        schemeIdUri: cp.getAttribute('schemeIdUri'),
        value: cp.getAttribute('value'),
        default_KID: cp.getAttribute('cenc:default_KID'),
        pssh: cp.querySelector('cenc\\:pssh, pssh')?.textContent
      }));
    }

    // Parse SegmentTemplate
    const segmentTemplate = adaptationSet.querySelector('SegmentTemplate');
    if (segmentTemplate) {
      as.SegmentTemplate = this.parseSegmentTemplate(segmentTemplate);
    }

    // Parse Representations
    const representations = adaptationSet.querySelectorAll('Representation');
    if (representations.length > 0) {
      as.Representation = Array.from(representations).map(rep => this.parseRepresentation(rep));
    }

    // Parse descriptors
    as.Role = this.parseDescriptors(adaptationSet, 'Role');
    as.Accessibility = this.parseDescriptors(adaptationSet, 'Accessibility');
    as.EssentialProperty = this.parseDescriptors(adaptationSet, 'EssentialProperty');
    as.SupplementalProperty = this.parseDescriptors(adaptationSet, 'SupplementalProperty');

    return as;
  }

  parseRepresentation(representation) {
    const rep = {
      id: representation.getAttribute('id'),
      bandwidth: parseInt(representation.getAttribute('bandwidth')),
      width: parseInt(representation.getAttribute('width')),
      height: parseInt(representation.getAttribute('height')),
      codecs: representation.getAttribute('codecs'),
      frameRate: representation.getAttribute('frameRate'),
      audioSamplingRate: parseInt(representation.getAttribute('audioSamplingRate')),
      sar: representation.getAttribute('sar')
    };

    // Parse SegmentTemplate
    const segmentTemplate = representation.querySelector('SegmentTemplate');
    if (segmentTemplate) {
      rep.SegmentTemplate = this.parseSegmentTemplate(segmentTemplate);
    }

    return rep;
  }

  parseSegmentTemplate(segmentTemplate) {
    const template = {
      timescale: parseInt(segmentTemplate.getAttribute('timescale')) || 1,
      duration: parseInt(segmentTemplate.getAttribute('duration')),
      startNumber: parseInt(segmentTemplate.getAttribute('startNumber')) || 1,
      media: segmentTemplate.getAttribute('media'),
      initialization: segmentTemplate.getAttribute('initialization')
    };

    // Parse SegmentTimeline
    const timeline = segmentTemplate.querySelector('SegmentTimeline');
    if (timeline) {
      const sElements = timeline.querySelectorAll('S');
      template.SegmentTimeline = {
        S: Array.from(sElements).map(s => ({
          t: parseInt(s.getAttribute('t')),
          d: parseInt(s.getAttribute('d')),
          r: parseInt(s.getAttribute('r'))
        }))
      };
    }

    return template;
  }

  parseDescriptors(element, tagName) {
    const descriptors = element.querySelectorAll(tagName);
    if (descriptors.length === 0) return null;
    
    return Array.from(descriptors).map(desc => ({
      schemeIdUri: desc.getAttribute('schemeIdUri'),
      value: desc.getAttribute('value')
    }));
  }

  mapSeverityToType(severity) {
    switch (severity) {
      case 'VERY_HIGH':
        return 'CRITICAL ERROR';
      case 'HIGH':
        return 'ERROR';
      case 'MEDIUM':
        return 'WARNING';
      case 'LOW':
        return 'INFO';
      case 'INFO':
        return 'INFO';
      default:
        return 'UNKNOWN';
    }
  }

  generateSolution(issue) {
    if (issue.solution) return issue.solution;
    
    // Generate solutions based on the issue type and message
    const message = issue.message.toLowerCase();
    
    if (message.includes('missing')) {
      return 'Add the missing element or attribute to the SSAI manifest';
    } else if (message.includes('mismatch')) {
      return 'Update the SSAI manifest to match the source value or verify if the difference is intentional';
    } else if (message.includes('removed')) {
      return 'Verify if the removal is intentional for SSAI processing';
    } else if (message.includes('duration')) {
      return 'Check segment durations and timing alignment between source and SSAI';
    } else if (message.includes('timeline')) {
      return 'Fix timeline continuity issues to prevent playback gaps or overlaps';
    } else if (message.includes('drm') || message.includes('contentprotection')) {
      return 'Ensure DRM systems and keys are properly configured in SSAI manifest';
    } else {
      return 'Review the issue details and update the SSAI manifest accordingly';
    }
  }

  // Helper methods for enhanced comparison
  
  ensureArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  inferContentType(mimeType) {
    if (!mimeType) return 'unknown';
    if (mimeType.includes('video')) return 'video';
    if (mimeType.includes('audio')) return 'audio';
    if (mimeType.includes('text') || mimeType.includes('application')) return 'text';
    return 'unknown';
  }

  extractRole(roleDescriptors) {
    if (!roleDescriptors) return 'main';
    const roles = this.ensureArray(roleDescriptors);
    if (roles.length === 0) return 'main';
    return roles.map(r => r.value || 'main').sort().join(',');
  }

  normalizeCodecs(codecs) {
    if (!codecs) return 'unknown';
    // Extract base codec without profile/level details
    return codecs.split('.')[0].toLowerCase();
  }

  getDefaultTimescale(context) {
    if (context.includes('video')) return this.config.defaultTimescales.video;
    if (context.includes('audio')) return this.config.defaultTimescales.audio;
    if (context.includes('text')) return this.config.defaultTimescales.text;
    return 1;
  }

  collectAllTimescales(mpd) {
    const timescales = {};
    
    const periods = this.ensureArray(mpd.Period);
    periods.forEach((period, pIndex) => {
      const adaptationSets = this.ensureArray(period.AdaptationSet);
      adaptationSets.forEach((as, asIndex) => {
        if (as.SegmentTemplate && as.SegmentTemplate.timescale) {
          const context = `Period[${pIndex}].AdaptationSet[${asIndex}]`;
          timescales[context] = as.SegmentTemplate.timescale;
        }
        
        const representations = this.ensureArray(as.Representation);
        representations.forEach((rep, repIndex) => {
          if (rep.SegmentTemplate && rep.SegmentTemplate.timescale) {
            const context = `Period[${pIndex}].AdaptationSet[${asIndex}].Representation[${repIndex}]`;
            timescales[context] = rep.SegmentTemplate.timescale;
          }
        });
      });
    });
    
    return timescales;
  }

  validateMultipleTimelines(sourceTimeline, ssaiTimeline, srcTimescale, ssaiTimescale, context) {
    const differences = [];
    
    const sourceSElements = this.ensureArray(sourceTimeline.S);
    const ssaiSElements = this.ensureArray(ssaiTimeline.S);
    
    // Compare timeline segment counts
    if (sourceSElements.length !== ssaiSElements.length) {
      differences.push({
        type: 'TIMELINE_SEGMENT_COUNT',
        tag: `SegmentTimeline (${context})`,
        attribute: 'S elements',
        sourceValue: sourceSElements.length.toString(),
        ssaiValue: ssaiSElements.length.toString(),
        solution: 'Ensure segment timeline has matching number of S elements',
        severity: 'HIGH',
        message: `Timeline segment count mismatch in ${context}`
      });
    }
    
    // Validate each timeline segment
    const minLength = Math.min(sourceSElements.length, ssaiSElements.length);
    for (let i = 0; i < minLength; i++) {
      const srcS = sourceSElements[i];
      const ssaiS = ssaiSElements[i];
      
      // Normalize durations to seconds
      const srcDuration = (srcS.d || 0) / srcTimescale;
      const ssaiDuration = (ssaiS.d || 0) / ssaiTimescale;
      
      const durationDiff = Math.abs(srcDuration - ssaiDuration);
      if (durationDiff > this.config.timingTolerance) {
        differences.push({
          type: 'TIMELINE_DURATION_MISMATCH',
          tag: `SegmentTimeline S[${i}] (${context})`,
          attribute: 'd',
          sourceValue: `${srcDuration.toFixed(3)}s`,
          ssaiValue: `${ssaiDuration.toFixed(3)}s`,
          solution: 'Adjust segment duration to match source timeline',
          severity: 'HIGH',
          message: `Timeline segment ${i} duration mismatch: ${durationDiff.toFixed(3)}s difference`
        });
      }
    }
    
    return differences;
  }

  validateSegmentAvailability(sourceMPD, ssaiMPD) {
    const differences = [];
    
    // Check timeShiftBufferDepth for live streams
    if (sourceMPD.timeShiftBufferDepth && ssaiMPD.timeShiftBufferDepth) {
      const srcDepth = this.parseDurationToSeconds(sourceMPD.timeShiftBufferDepth);
      const ssaiDepth = this.parseDurationToSeconds(ssaiMPD.timeShiftBufferDepth);
      
      if (srcDepth && ssaiDepth && ssaiDepth < srcDepth * 0.9) {
        differences.push({
          type: 'TIMESHIFT_BUFFER_REDUCED',
          tag: 'MPD',
          attribute: 'timeShiftBufferDepth',
          sourceValue: `${srcDepth.toFixed(1)}s`,
          ssaiValue: `${ssaiDepth.toFixed(1)}s`,
          solution: 'Increase timeShiftBufferDepth in SSAI manifest to match source',
          severity: 'HIGH',
          message: 'TimeShift buffer significantly reduced in SSAI manifest'
        });
      }
    }
    
    return differences;
  }

  parseDurationToSeconds(duration) {
    if (!duration) return null;
    if (typeof duration === 'number') return duration;
    
    // Parse ISO 8601 duration format (PT1H30M45S)
    const regex = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/;
    const matches = duration.match(regex);
    
    if (!matches) return null;
    
    const hours = parseFloat(matches[1] || 0);
    const minutes = parseFloat(matches[2] || 0);
    const seconds = parseFloat(matches[3] || 0);
    
    return hours * 3600 + minutes * 60 + seconds;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Legacy methods for backward compatibility
  getAttributes(node) {
    const attrs = {};
    for (let attr of node.attributes || []) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  getTimescale(xml) {
    const segmentTemplate = xml?.querySelector('SegmentTemplate');
    return segmentTemplate ? parseInt(segmentTemplate.getAttribute('timescale')) || 90000 : 90000;
  }

  getSegmentTimings(xml) {
    const timeline = xml?.querySelector('SegmentTimeline');
    if (!timeline) return [];

    const times = [];
    const sElems = timeline.querySelectorAll('S');
    const timescale = this.getTimescale(xml);
    let currentTime = 0;

    sElems.forEach(s => {
      const d = parseInt(s.getAttribute('d')) / timescale;
      const r = parseInt(s.getAttribute('r') || '0');
      const t = s.getAttribute('t') ? parseInt(s.getAttribute('t')) / timescale : null;
      
      if (t !== null && times.length === 0) {
        currentTime = t;
      }
      
      for (let i = 0; i <= r; i++) {
        times.push({ start: currentTime, duration: d });
        currentTime += d;
      }
    });

    return times;
  }
}