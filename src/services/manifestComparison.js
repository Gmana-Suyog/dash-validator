import SSAIMPDValidator from "../logic/validation.js";

export class ManifestComparison {
  constructor() {
    this.validator = SSAIMPDValidator;
    // Enhanced configuration for robust comparison with SSAI-specific rules
    this.config = {
      timingTolerance: 0.001, // 1ms tolerance for timing comparisons
      attributeTolerance: {
        bandwidth: 0.01, // 1% tolerance for bandwidth
        duration: 0.001, // 1ms tolerance for durations
        frameRate: 0.01, // 1% tolerance for frame rates
      },
      defaultTimescales: {
        video: 90000,
        audio: 48000,
        text: 1000,
      },
      semanticMatching: true, // Use semantic matching instead of index-based
      cumulativeDriftThreshold: 0.1, // 100ms cumulative drift threshold

      // SSAI-specific tolerances and rules
      ssaiRules: {
        // Duration tolerance for SSAI (ads can extend content)
        durationIncreaseTolerance: 2.0, // Allow up to 200% increase for heavy ad load
        durationDecreaseTolerance: 0.05, // Allow 5% decrease for minor trimming

        // Buffer time adjustments for ad transitions
        minBufferTimeMultiplier: 1.2, // SSAI should have 20% more buffer time

        // Live stream specific tolerances
        liveTolerances: {
          availabilityStartTimeDrift: 1.0, // 1 second tolerance for live start time
          timeShiftBufferReduction: 0.1, // Allow 10% reduction in timeshift buffer
          minimumUpdatePeriodVariation: 0.5, // 50% variation allowed in update period
        },

        // VOD specific tolerances
        vodTolerances: {
          mediaPresentationDurationTolerance: 0.001, // 1ms tolerance for VOD duration
          strictTimingValidation: true, // Stricter validation for VOD content
        },
      },
    };
  }

  compareManifests(sourceManifest, ssaiManifest) {
    if (!sourceManifest || !ssaiManifest) return [];

    // Enhanced comparison with robust matching
    const enhancedComparison = this.performEnhancedComparison(
      sourceManifest,
      ssaiManifest
    );

    // Run comprehensive validation
    const comprehensiveValidation = this.performComprehensiveValidation(
      sourceManifest,
      ssaiManifest
    );

    // Add semantic validation results
    const semanticValidation = this.processSemanticValidation(
      sourceManifest,
      ssaiManifest
    );

    // Combine results with deduplication
    return this.combineValidationResults(
      enhancedComparison,
      comprehensiveValidation,
      semanticValidation,
      sourceManifest,
      ssaiManifest
    );
  }

  async combineValidationResults(
    enhancedResults,
    comprehensivePromise,
    semanticResults = [],
    sourceManifest = null,
    ssaiManifest = null
  ) {
    try {
      const comprehensiveResults = await comprehensivePromise;

      // Create a map for efficient deduplication
      const issueMap = new Map();

      // Add enhanced results first
      enhancedResults.forEach((result) => {
        const key = this.generateIssueKey(result);
        if (!issueMap.has(key)) {
          issueMap.set(key, result);
        }
      });

      // Add comprehensive results, avoiding duplicates
      comprehensiveResults.forEach((compResult) => {
        const key = this.generateIssueKey(compResult);
        if (!issueMap.has(key)) {
          issueMap.set(key, compResult);
        } else {
          // Merge additional information if available
          const existing = issueMap.get(key);
          if (compResult.impact && !existing.impact) {
            existing.impact = compResult.impact;
          }
          if (
            compResult.solution &&
            existing.solution.length < compResult.solution.length
          ) {
            existing.solution = compResult.solution;
          }
        }
      });

      // Add semantic validation results
      semanticResults.forEach((semanticResult) => {
        const key = this.generateIssueKey(semanticResult);
        if (!issueMap.has(key)) {
          issueMap.set(key, semanticResult);
        }
      });

      // Add uncovered attributes detection
      const uncoveredItems = this.detectUncoveredAttributes(
        sourceManifest,
        ssaiManifest
      );
      uncoveredItems.forEach((uncoveredItem) => {
        const key = this.generateIssueKey(uncoveredItem);
        if (!issueMap.has(key)) {
          issueMap.set(key, uncoveredItem);
        }
      });

      return Array.from(issueMap.values());
    } catch (error) {
      console.warn(
        "Comprehensive validation failed, using enhanced comparison only:",
        error
      );
      return [...enhancedResults, ...semanticResults];
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
      differences.push(
        ...this.validateTimescaleConsistency(sourceMPD, ssaiMPD)
      );

      // 4. Fix: Dynamic/live MPD support
      differences.push(...this.validateDynamicMPDFeatures(sourceMPD, ssaiMPD));

      // 5. Fix: Cumulative drift detection
      differences.push(...this.detectCumulativeDrift(sourceMPD, ssaiMPD));

      // 6. Fix: Attribute tolerance for false positives
      differences.push(
        ...this.compareAttributesWithTolerance(sourceMPD, ssaiMPD)
      );

      // 7. Enhanced: Robust attribute-level comparison
      differences.push(
        ...this.performRobustAttributeComparison(sourceMPD, ssaiMPD)
      );

      // 8. Enhanced: Timeline drift validation
      differences.push(...this.validateTimelineDrift(sourceMPD, ssaiMPD));

      // 9. Enhanced: Semantic matching validation
      differences.push(...this.validateSemanticMatching(sourceMPD, ssaiMPD));

      // 10. Enhanced: SegmentTemplate/Timeline validation
      differences.push(
        ...this.validateSegmentTemplateAlignment(sourceMPD, ssaiMPD)
      );

      // 11. Enhanced: EventStream validation
      differences.push(...this.validateEventStreamTiming(sourceMPD, ssaiMPD));

      // 12. Enhanced: DRM/ContentProtection validation
      differences.push(
        ...this.validateDRMContentProtection(sourceMPD, ssaiMPD)
      );
    } catch (error) {
      differences.push({
        type: "ERROR",
        tag: "Enhanced Comparison",
        attribute: "",
        sourceValue: "",
        ssaiValue: "",
        solution: "Check manifest format and structure",
        severity: "HIGH",
        message: `Enhanced comparison failed: ${error.message}`,
      });
    }

    return differences;
  }

  performRobustAttributeComparison(sourceMPD, ssaiMPD) {
    const differences = [];

    // Critical attributes that need robust comparison
    const criticalAttributes = [
      { path: "mediaPresentationDuration", type: "duration", tolerance: 0.001 },
      { path: "minBufferTime", type: "duration", tolerance: 0.001 },
      { path: "timeShiftBufferDepth", type: "duration", tolerance: 0.1 },
      { path: "maxSegmentDuration", type: "duration", tolerance: 0.001 },
      { path: "suggestedPresentationDelay", type: "duration", tolerance: 0.1 },
    ];

    criticalAttributes.forEach(({ path, type, tolerance }) => {
      const sourceValue = this.getNestedValue(sourceMPD, path);
      const ssaiValue = this.getNestedValue(ssaiMPD, path);

      if (sourceValue && ssaiValue) {
        const comparison = this.compareWithTolerance(
          sourceValue,
          ssaiValue,
          type,
          tolerance
        );
        if (comparison.mismatch) {
          differences.push({
            type: "ATTRIBUTE_MISMATCH",
            tag: "MPD",
            attribute: path,
            sourceValue: comparison.sourceFormatted,
            ssaiValue: comparison.ssaiFormatted,
            solution: `Adjust ${path} in SSAI manifest - difference exceeds tolerance`,
            severity: comparison.severity,
            message: `${path} mismatch: ${comparison.difference}`,
          });
        }
      }
    });

    return differences;
  }

  validateTimelineDrift(sourceMPD, ssaiMPD) {
    const differences = [];

    try {
      const sourcePeriods = this.ensureArray(sourceMPD.Period);
      const ssaiPeriods = this.ensureArray(ssaiMPD.Period);

      let cumulativeSourceTime = 0;
      let cumulativeSSAITime = 0;
      let maxDrift = 0;

      // Calculate cumulative timeline drift across all periods
      for (
        let i = 0;
        i < Math.min(sourcePeriods.length, ssaiPeriods.length);
        i++
      ) {
        const sourcePeriod = sourcePeriods[i];
        const ssaiPeriod = ssaiPeriods[i];

        if (!sourcePeriod || !ssaiPeriod) continue;

        // Parse period timing
        const sourceStart =
          this.parseDurationToSeconds(sourcePeriod.start) ||
          cumulativeSourceTime;
        const ssaiStart =
          this.parseDurationToSeconds(ssaiPeriod.start) || cumulativeSSAITime;
        const sourceDuration =
          this.parseDurationToSeconds(sourcePeriod.duration) || 0;
        const ssaiDuration =
          this.parseDurationToSeconds(ssaiPeriod.duration) || 0;

        // Calculate drift for this period
        const startDrift = Math.abs(sourceStart - ssaiStart);
        const durationDrift = Math.abs(sourceDuration - ssaiDuration);

        maxDrift = Math.max(maxDrift, startDrift, durationDrift);

        // Update cumulative times
        cumulativeSourceTime = sourceStart + sourceDuration;
        cumulativeSSAITime = ssaiStart + ssaiDuration;

        // Check for significant drift
        if (startDrift > 0.1) {
          // 100ms tolerance
          differences.push({
            type: "TIMELINE_START_DRIFT",
            tag: `Period[${i}]`,
            attribute: "start",
            sourceValue: `${sourceStart.toFixed(3)}s`,
            ssaiValue: `${ssaiStart.toFixed(3)}s`,
            solution: "Align period start times to prevent timeline drift",
            severity: startDrift > 1.0 ? "HIGH" : "MEDIUM",
            message: `Period start time drift: ${startDrift.toFixed(3)}s`,
          });
        }

        if (durationDrift > 0.1 && !this.isAdPeriod(ssaiPeriod)) {
          // Allow ad periods to have different durations
          differences.push({
            type: "TIMELINE_DURATION_DRIFT",
            tag: `Period[${i}]`,
            attribute: "duration",
            sourceValue: `${sourceDuration.toFixed(3)}s`,
            ssaiValue: `${ssaiDuration.toFixed(3)}s`,
            solution: "Verify period duration consistency for content periods",
            severity: durationDrift > 1.0 ? "HIGH" : "MEDIUM",
            message: `Period duration drift: ${durationDrift.toFixed(3)}s`,
          });
        }
      }

      // Check overall timeline drift
      const totalDrift = Math.abs(cumulativeSourceTime - cumulativeSSAITime);
      if (totalDrift > 0.5) {
        // 500ms total tolerance
        differences.push({
          type: "CUMULATIVE_TIMELINE_DRIFT",
          tag: "Timeline",
          attribute: "total_duration",
          sourceValue: `${cumulativeSourceTime.toFixed(3)}s`,
          ssaiValue: `${cumulativeSSAITime.toFixed(3)}s`,
          solution:
            "Review overall timeline alignment - significant cumulative drift detected",
          severity: totalDrift > 2.0 ? "VERY_HIGH" : "HIGH",
          message: `Total timeline drift: ${totalDrift.toFixed(3)}s`,
        });
      }
    } catch (error) {
      console.warn("Timeline drift validation failed:", error);
    }

    return differences;
  }

  validateSemanticMatching(sourceMPD, ssaiMPD) {
    const differences = [];

    const sourcePeriods = this.ensureArray(sourceMPD.Period);
    const ssaiPeriods = this.ensureArray(ssaiMPD.Period);

    sourcePeriods.forEach((sourcePeriod, periodIndex) => {
      if (!sourcePeriod) return;

      const matchingSSAIPeriod = this.findSemanticPeriodMatch(
        sourcePeriod,
        ssaiPeriods
      );
      if (!matchingSSAIPeriod) return;

      const sourceAS = this.ensureArray(sourcePeriod.AdaptationSet);
      const ssaiAS = this.ensureArray(matchingSSAIPeriod.AdaptationSet);

      sourceAS.forEach((srcAS, asIndex) => {
        if (!srcAS) return;

        const matchingSSAIAS = this.findSemanticAdaptationSetMatch(
          srcAS,
          ssaiAS
        );
        if (!matchingSSAIAS) {
          differences.push({
            type: "SEMANTIC_ADAPTATIONSET_MISSING",
            tag: `Period[${periodIndex}].AdaptationSet[${asIndex}]`,
            attribute: "semantic_match",
            sourceValue: this.getAdaptationSetSignature(srcAS),
            ssaiValue: "Missing",
            solution:
              "Add semantically matching AdaptationSet to SSAI manifest",
            severity: "VERY_HIGH",
            message: "No semantic match found for AdaptationSet",
          });
          return;
        }

        // Validate semantic attributes
        const semanticValidation = this.validateAdaptationSetSemantics(
          srcAS,
          matchingSSAIAS,
          periodIndex,
          asIndex
        );
        differences.push(...semanticValidation);

        // Validate representations
        const sourceReps = this.ensureArray(srcAS.Representation);
        const ssaiReps = this.ensureArray(matchingSSAIAS.Representation);

        sourceReps.forEach((srcRep, repIndex) => {
          if (!srcRep) return;

          const matchingSSAIRep = this.findSemanticRepresentationMatch(
            srcRep,
            ssaiReps
          );
          if (!matchingSSAIRep) {
            differences.push({
              type: "SEMANTIC_REPRESENTATION_MISSING",
              tag: `Period[${periodIndex}].AdaptationSet[${asIndex}].Representation[${repIndex}]`,
              attribute: "semantic_match",
              sourceValue: this.getRepresentationSignature(srcRep),
              ssaiValue: "Missing",
              solution:
                "Add semantically matching Representation to SSAI manifest",
              severity: "HIGH",
              message: "No semantic match found for Representation",
            });
            return;
          }

          // Validate representation semantics
          const repSemanticValidation = this.validateRepresentationSemantics(
            srcRep,
            matchingSSAIRep,
            periodIndex,
            asIndex,
            repIndex
          );
          differences.push(...repSemanticValidation);
        });
      });
    });

    return differences;
  }

  validateSegmentTemplateAlignment(sourceMPD, ssaiMPD) {
    const differences = [];

    const sourcePeriods = this.ensureArray(sourceMPD.Period);
    const ssaiPeriods = this.ensureArray(ssaiMPD.Period);

    sourcePeriods.forEach((sourcePeriod, periodIndex) => {
      const matchingSSAIPeriod = this.findSemanticPeriodMatch(
        sourcePeriod,
        ssaiPeriods
      );
      if (!matchingSSAIPeriod) return;

      const sourceAS = this.ensureArray(sourcePeriod.AdaptationSet);
      const ssaiAS = this.ensureArray(matchingSSAIPeriod.AdaptationSet);

      sourceAS.forEach((srcAS, asIndex) => {
        const matchingSSAIAS = this.findSemanticAdaptationSetMatch(
          srcAS,
          ssaiAS
        );
        if (!matchingSSAIAS) return;

        // Validate SegmentTemplate alignment
        if (srcAS.SegmentTemplate && matchingSSAIAS.SegmentTemplate) {
          const templateValidation = this.validateSegmentTemplateEquivalence(
            srcAS.SegmentTemplate,
            matchingSSAIAS.SegmentTemplate,
            `Period[${periodIndex}].AdaptationSet[${asIndex}]`
          );
          differences.push(...templateValidation);
        }

        // Validate per-representation SegmentTemplates
        const sourceReps = this.ensureArray(srcAS.Representation);
        const ssaiReps = this.ensureArray(matchingSSAIAS.Representation);

        sourceReps.forEach((srcRep, repIndex) => {
          const matchingSSAIRep = this.findSemanticRepresentationMatch(
            srcRep,
            ssaiReps
          );
          if (!matchingSSAIRep) return;

          if (srcRep.SegmentTemplate && matchingSSAIRep.SegmentTemplate) {
            const repTemplateValidation =
              this.validateSegmentTemplateEquivalence(
                srcRep.SegmentTemplate,
                matchingSSAIRep.SegmentTemplate,
                `Period[${periodIndex}].AdaptationSet[${asIndex}].Representation[${repIndex}]`
              );
            differences.push(...repTemplateValidation);
          }
        });
      });
    });

    return differences;
  }

  validateEventStreamTiming(sourceMPD, ssaiMPD) {
    const differences = [];

    const sourcePeriods = this.ensureArray(sourceMPD.Period);
    const ssaiPeriods = this.ensureArray(ssaiMPD.Period);

    sourcePeriods.forEach((sourcePeriod, periodIndex) => {
      if (!sourcePeriod.EventStream) return;

      const matchingSSAIPeriod = this.findSemanticPeriodMatch(
        sourcePeriod,
        ssaiPeriods
      );
      if (!matchingSSAIPeriod) return;

      const sourceEvents = this.ensureArray(sourcePeriod.EventStream);
      const ssaiEvents = this.ensureArray(matchingSSAIPeriod.EventStream || []);

      sourceEvents.forEach((srcEvent, eventIndex) => {
        if (!srcEvent) return;

        // Check for SCTE-35 events
        if (this.isSCTE35Event(srcEvent)) {
          const matchingSSAIEvent = this.findMatchingEvent(
            srcEvent,
            ssaiEvents
          );

          if (!matchingSSAIEvent) {
            differences.push({
              type: "SCTE35_EVENT_MISSING",
              tag: `Period[${periodIndex}].EventStream[${eventIndex}]`,
              attribute: "schemeIdUri",
              sourceValue: srcEvent.schemeIdUri,
              ssaiValue: "Missing",
              solution: "Verify SCTE-35 event handling in SSAI processing",
              severity: "HIGH",
              message: "SCTE-35 event missing in SSAI manifest",
            });
          } else {
            // Validate event timing
            const timingValidation = this.validateEventTiming(
              srcEvent,
              matchingSSAIEvent,
              periodIndex,
              eventIndex
            );
            differences.push(...timingValidation);
          }
        }
      });
    });

    return differences;
  }

  validateDRMContentProtection(sourceMPD, ssaiMPD) {
    const differences = [];

    // Validate root-level ContentProtection
    if (sourceMPD.ContentProtection) {
      const rootDRMValidation = this.validateContentProtectionEquivalence(
        sourceMPD.ContentProtection,
        ssaiMPD.ContentProtection || [],
        "MPD"
      );
      differences.push(...rootDRMValidation);
    }

    // Validate AdaptationSet and Representation level ContentProtection
    const sourcePeriods = this.ensureArray(sourceMPD.Period);
    const ssaiPeriods = this.ensureArray(ssaiMPD.Period);

    sourcePeriods.forEach((sourcePeriod, periodIndex) => {
      const matchingSSAIPeriod = this.findSemanticPeriodMatch(
        sourcePeriod,
        ssaiPeriods
      );
      if (!matchingSSAIPeriod) return;

      const sourceAS = this.ensureArray(sourcePeriod.AdaptationSet);
      const ssaiAS = this.ensureArray(matchingSSAIPeriod.AdaptationSet);

      sourceAS.forEach((srcAS, asIndex) => {
        const matchingSSAIAS = this.findSemanticAdaptationSetMatch(
          srcAS,
          ssaiAS
        );
        if (!matchingSSAIAS) return;

        // Validate AdaptationSet ContentProtection
        if (srcAS.ContentProtection) {
          const asDRMValidation = this.validateContentProtectionEquivalence(
            srcAS.ContentProtection,
            matchingSSAIAS.ContentProtection || [],
            `Period[${periodIndex}].AdaptationSet[${asIndex}]`
          );
          differences.push(...asDRMValidation);
        }

        // Validate Representation ContentProtection
        const sourceReps = this.ensureArray(srcAS.Representation);
        const ssaiReps = this.ensureArray(matchingSSAIAS.Representation);

        sourceReps.forEach((srcRep, repIndex) => {
          const matchingSSAIRep = this.findSemanticRepresentationMatch(
            srcRep,
            ssaiReps
          );
          if (!matchingSSAIRep || !srcRep.ContentProtection) return;

          const repDRMValidation = this.validateContentProtectionEquivalence(
            srcRep.ContentProtection,
            matchingSSAIRep.ContentProtection || [],
            `Period[${periodIndex}].AdaptationSet[${asIndex}].Representation[${repIndex}]`
          );
          differences.push(...repDRMValidation);
        });
      });
    });

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
    Object.keys(sourcePeriodsMap).forEach((semanticKey) => {
      if (!ssaiPeriodsMap[semanticKey]) {
        differences.push({
          type: "MISSING_PERIOD",
          tag: `Period (${semanticKey})`,
          attribute: "Period",
          sourceValue: "Present",
          ssaiValue: "Missing",
          solution:
            "Add missing period to SSAI manifest or verify if removal is intentional for ad insertion",
          severity: "HIGH",
          message: `Period with semantic key "${semanticKey}" missing in SSAI manifest`,
        });
      }
    });

    // Compare adaptation sets within matching periods
    Object.keys(sourcePeriodsMap).forEach((semanticKey) => {
      const sourcePeriod = sourcePeriodsMap[semanticKey];
      const ssaiPeriod = ssaiPeriodsMap[semanticKey];

      if (sourcePeriod && ssaiPeriod) {
        differences.push(
          ...this.compareAdaptationSetsSemanticaly(
            sourcePeriod,
            ssaiPeriod,
            semanticKey
          )
        );
      }
    });

    return differences;
  }

  createPeriodSemanticMap(periods) {
    const map = {};
    periods.forEach((period, index) => {
      // Create semantic key based on period characteristics
      const start = period.start || `index_${index}`;
      const duration = period.duration || "unknown";

      // Use multiple fallback strategies for matching
      const semanticKey =
        period.id || `${start}_${duration}` || `index_${index}`;
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
    Object.keys(sourceASMap).forEach((semanticKey) => {
      if (!ssaiASMap[semanticKey]) {
        differences.push({
          type: "MISSING_ADAPTATION_SET",
          tag: `AdaptationSet (${periodKey}:${semanticKey})`,
          attribute: "AdaptationSet",
          sourceValue: "Present",
          ssaiValue: "Missing",
          solution: "Add missing adaptation set to SSAI manifest",
          severity: "VERY_HIGH",
          message: `AdaptationSet "${semanticKey}" missing in period "${periodKey}"`,
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
      const lang = as.lang || "und";
      const role = this.extractRole(as.Role) || "main";
      const codecs = this.normalizeCodecs(as.codecs) || "unknown";

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
          differences.push(
            ...this.validateSegmentTemplate(
              srcAS.SegmentTemplate,
              ssaiASMatch.SegmentTemplate,
              `Period[${periodIndex}].AdaptationSet[${asIndex}]`
            )
          );
        }

        // Check per-representation SegmentTemplates
        const sourceReps = this.ensureArray(srcAS.Representation);
        const ssaiReps = this.ensureArray(ssaiASMatch.Representation);

        sourceReps.forEach((srcRep, repIndex) => {
          const ssaiRep = ssaiReps[repIndex];
          if (!ssaiRep) return;

          if (srcRep.SegmentTemplate && ssaiRep.SegmentTemplate) {
            differences.push(
              ...this.validateSegmentTemplate(
                srcRep.SegmentTemplate,
                ssaiRep.SegmentTemplate,
                `Period[${periodIndex}].AdaptationSet[${asIndex}].Representation[${repIndex}]`
              )
            );
          }
        });
      });
    });

    return differences;
  }

  validateSegmentTemplate(sourceTemplate, ssaiTemplate, context) {
    const differences = [];

    // Validate timescale consistency
    const srcTimescale =
      sourceTemplate.timescale || this.getDefaultTimescale(context);
    const ssaiTimescale =
      ssaiTemplate.timescale || this.getDefaultTimescale(context);

    if (srcTimescale !== ssaiTimescale) {
      differences.push({
        type: "TIMESCALE_MISMATCH",
        tag: `SegmentTemplate (${context})`,
        attribute: "timescale",
        sourceValue: srcTimescale.toString(),
        ssaiValue: ssaiTimescale.toString(),
        solution:
          "Ensure timescale values match between source and SSAI manifests",
        severity: "VERY_HIGH",
        message: `Timescale mismatch in ${context}: source=${srcTimescale}, ssai=${ssaiTimescale}`,
      });
    }

    // Validate multiple timelines if present
    if (sourceTemplate.SegmentTimeline && ssaiTemplate.SegmentTimeline) {
      differences.push(
        ...this.validateMultipleTimelines(
          sourceTemplate.SegmentTimeline,
          ssaiTemplate.SegmentTimeline,
          srcTimescale,
          ssaiTimescale,
          context
        )
      );
    }

    return differences;
  }

  validateTimescaleConsistency(sourceMPD, ssaiMPD) {
    const differences = [];

    // Collect all timescales from the manifest
    const sourceTimescales = this.collectAllTimescales(sourceMPD);
    const ssaiTimescales = this.collectAllTimescales(ssaiMPD);

    // Check for inconsistent defaults
    Object.keys(sourceTimescales).forEach((context) => {
      const sourceValue = sourceTimescales[context];
      const ssaiValue = ssaiTimescales[context];

      if (sourceValue && ssaiValue && sourceValue !== ssaiValue) {
        differences.push({
          type: "TIMESCALE_INCONSISTENCY",
          tag: `Timescale (${context})`,
          attribute: "timescale",
          sourceValue: sourceValue.toString(),
          ssaiValue: ssaiValue.toString(),
          solution: "Standardize timescale values across all segment templates",
          severity: "HIGH",
          message: `Inconsistent timescale in ${context}`,
        });
      }
    });

    return differences;
  }

  validateDynamicMPDFeatures(sourceMPD, ssaiMPD) {
    const differences = [];

    // Check if this is a dynamic MPD
    if (sourceMPD.type === "dynamic" || ssaiMPD.type === "dynamic") {
      // Validate live-specific attributes
      const liveAttributes = [
        "availabilityStartTime",
        "minimumUpdatePeriod",
        "timeShiftBufferDepth",
        "suggestedPresentationDelay",
      ];

      liveAttributes.forEach((attr) => {
        if (sourceMPD[attr] && !ssaiMPD[attr]) {
          differences.push({
            type: "MISSING_LIVE_ATTRIBUTE",
            tag: "MPD",
            attribute: attr,
            sourceValue: sourceMPD[attr],
            ssaiValue: "Missing",
            solution: `Add ${attr} to SSAI manifest for proper live streaming support`,
            severity: "VERY_HIGH",
            message: `Missing live streaming attribute: ${attr}`,
          });
        }
      });

      // Validate UTCTiming for live streams
      if (!ssaiMPD.UTCTiming && sourceMPD.type === "dynamic") {
        differences.push({
          type: "MISSING_UTC_TIMING",
          tag: "MPD",
          attribute: "UTCTiming",
          sourceValue: "Present",
          ssaiValue: "Missing",
          solution:
            "Add UTCTiming element for clock synchronization in live streams",
          severity: "VERY_HIGH",
          message:
            "UTCTiming missing for dynamic MPD - required for live streaming",
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
      for (
        let i = 0;
        i < Math.min(sourcePeriods.length, ssaiPeriods.length);
        i++
      ) {
        const sourcePeriod = sourcePeriods[i];
        const ssaiPeriod = ssaiPeriods[i];

        // Parse period start times
        const sourceStart =
          this.parseDurationToSeconds(sourcePeriod.start) || sourceTime;
        const ssaiStart =
          this.parseDurationToSeconds(ssaiPeriod.start) || ssaiTime;

        // Calculate drift for this period
        const periodDrift = Math.abs(sourceStart - ssaiStart);
        cumulativeDrift += periodDrift;

        // Update running times
        const sourceDuration =
          this.parseDurationToSeconds(sourcePeriod.duration) || 0;
        const ssaiDuration =
          this.parseDurationToSeconds(ssaiPeriod.duration) || 0;

        sourceTime = sourceStart + sourceDuration;
        ssaiTime = ssaiStart + ssaiDuration;

        // Check if cumulative drift exceeds threshold
        if (cumulativeDrift > this.config.cumulativeDriftThreshold) {
          differences.push({
            type: "CUMULATIVE_DRIFT",
            tag: `Timeline Drift (Period ${i})`,
            attribute: "timing",
            sourceValue: `${sourceTime.toFixed(3)}s`,
            ssaiValue: `${ssaiTime.toFixed(3)}s`,
            solution:
              "Review timing alignment across all periods to prevent cumulative drift",
            severity: "HIGH",
            message: `Cumulative timing drift of ${cumulativeDrift.toFixed(
              3
            )}s detected at period ${i}`,
          });
          break; // Report only the first significant drift
        }
      }
    } catch (error) {
      // Don't fail the entire comparison if drift detection fails
      console.warn("Cumulative drift detection failed:", error);
    }

    return differences;
  }

  compareAttributesWithTolerance(sourceMPD, ssaiMPD) {
    const differences = [];

    // Determine if this is live or VOD content for conditional validation
    const isLive = sourceMPD.type === "dynamic" || ssaiMPD.type === "dynamic";

    // Enhanced attribute comparison with SSAI-aware tolerances
    const attributeComparisons = [
      {
        path: "minBufferTime",
        tolerance: "duration",
        ssaiRule: "minBufferTimeMultiplier",
        critical: true,
      },
      {
        path: "mediaPresentationDuration",
        tolerance: isLive ? "duration" : "mediaPresentationDurationTolerance",
        ssaiRule: "durationTolerance",
        critical: !isLive, // More critical for VOD
      },
      {
        path: "timeShiftBufferDepth",
        tolerance: "duration",
        ssaiRule: "timeShiftBufferReduction",
        liveOnly: true,
      },
      {
        path: "availabilityStartTime",
        tolerance: "availabilityStartTimeDrift",
        liveOnly: true,
        critical: true,
      },
      {
        path: "minimumUpdatePeriod",
        tolerance: "minimumUpdatePeriodVariation",
        liveOnly: true,
        critical: false,
      },
    ];

    attributeComparisons.forEach(
      ({ path, tolerance, ssaiRule, critical, liveOnly }) => {
        // Skip live-only attributes for VOD content
        if (liveOnly && !isLive) return;

        const sourceValue = this.getNestedValue(sourceMPD, path);
        const ssaiValue = this.getNestedValue(ssaiMPD, path);

        if (sourceValue && ssaiValue) {
          const comparison = this.compareAttributeWithSSAIRules(
            sourceValue,
            ssaiValue,
            path,
            tolerance,
            ssaiRule,
            isLive,
            critical
          );

          if (comparison.issue) {
            differences.push(comparison.issue);
          }
        } else if (sourceValue && !ssaiValue && critical) {
          differences.push({
            type: "MISSING_CRITICAL_ATTRIBUTE",
            tag: "MPD",
            attribute: path,
            sourceValue: sourceValue,
            ssaiValue: "Missing",
            solution: `Add missing ${path} to SSAI manifest - critical for ${
              isLive ? "live" : "VOD"
            } playback`,
            severity: critical ? "VERY_HIGH" : "HIGH",
            message: `Critical attribute ${path} missing in SSAI manifest`,
          });
        }
      }
    );

    return differences;
  }

  compareAttributeWithSSAIRules(
    sourceValue,
    ssaiValue,
    attributeName,
    tolerance,
    ssaiRule,
    isLive,
    critical
  ) {
    // Parse duration values if needed
    const srcSeconds = this.parseDurationToSeconds(sourceValue);
    const ssaiSeconds = this.parseDurationToSeconds(ssaiValue);

    if (srcSeconds === null || ssaiSeconds === null) {
      // Handle non-duration attributes
      if (attributeName === "availabilityStartTime") {
        return this.compareTimestamps(
          sourceValue,
          ssaiValue,
          tolerance,
          critical
        );
      }
      return { issue: null }; // Skip comparison if parsing fails
    }

    // Apply SSAI-specific rules
    let toleranceValue;
    let expectedBehavior = "match";

    switch (attributeName) {
      case "minBufferTime": {
        // SSAI should have equal or more buffer time for ad transitions
        toleranceValue = srcSeconds * 0.01; // 1% tolerance
        const recommendedSSAIBuffer =
          srcSeconds * this.config.ssaiRules.minBufferTimeMultiplier;
        if (ssaiSeconds < srcSeconds) {
          return {
            issue: {
              type: "BUFFER_TIME_REDUCED",
              tag: "MPD",
              attribute: attributeName,
              sourceValue: `${srcSeconds.toFixed(3)}s`,
              ssaiValue: `${ssaiSeconds.toFixed(3)}s`,
              solution: `Increase minBufferTime to at least ${srcSeconds.toFixed(
                3
              )}s (recommended: ${recommendedSSAIBuffer.toFixed(
                3
              )}s) for smooth ad transitions`,
              severity: "HIGH",
              message: `SSAI reduced buffer time below source value - may cause rebuffering during ad transitions`,
            },
          };
        }
        expectedBehavior = "increase_allowed";
        break;
      }

      case "mediaPresentationDuration":
        if (isLive) {
          // Live content duration can vary significantly
          toleranceValue = Math.max(srcSeconds * 0.1, 10); // 10% or 10 seconds
          expectedBehavior = "flexible";
        } else {
          // VOD content should have predictable duration changes
          const maxIncrease =
            srcSeconds * this.config.ssaiRules.durationIncreaseTolerance;
          const minDecrease =
            srcSeconds * (1 - this.config.ssaiRules.durationDecreaseTolerance);

          if (ssaiSeconds > maxIncrease) {
            return {
              issue: {
                type: "EXCESSIVE_DURATION_INCREASE",
                tag: "MPD",
                attribute: attributeName,
                sourceValue: `${srcSeconds.toFixed(2)}s`,
                ssaiValue: `${ssaiSeconds.toFixed(2)}s`,
                solution: `Verify ad insertion - duration increased by ${(
                  ((ssaiSeconds - srcSeconds) / srcSeconds) *
                  100
                ).toFixed(1)}% which exceeds expected range`,
                severity: "HIGH",
                message: `SSAI duration increase exceeds reasonable ad insertion limits`,
              },
            };
          } else if (ssaiSeconds < minDecrease) {
            return {
              issue: {
                type: "CONTENT_DURATION_REDUCED",
                tag: "MPD",
                attribute: attributeName,
                sourceValue: `${srcSeconds.toFixed(2)}s`,
                ssaiValue: `${ssaiSeconds.toFixed(2)}s`,
                solution: `Verify content integrity - duration reduced by ${(
                  ((srcSeconds - ssaiSeconds) / srcSeconds) *
                  100
                ).toFixed(1)}% which may indicate missing content`,
                severity: "VERY_HIGH",
                message: `SSAI duration significantly reduced - content may be missing`,
              },
            };
          }
          toleranceValue = srcSeconds * 0.001; // 0.1% tolerance for VOD
        }
        break;

      case "timeShiftBufferDepth": {
        // Allow some reduction but warn if significant
        const maxReduction =
          srcSeconds *
          this.config.ssaiRules.liveTolerances.timeShiftBufferReduction;
        if (ssaiSeconds < srcSeconds - maxReduction) {
          return {
            issue: {
              type: "TIMESHIFT_BUFFER_SIGNIFICANTLY_REDUCED",
              tag: "MPD",
              attribute: attributeName,
              sourceValue: `${srcSeconds.toFixed(1)}s`,
              ssaiValue: `${ssaiSeconds.toFixed(1)}s`,
              solution: `Increase timeShiftBufferDepth - current reduction of ${(
                ((srcSeconds - ssaiSeconds) / srcSeconds) *
                100
              ).toFixed(1)}% may affect user experience`,
              severity: "MEDIUM",
              message: `TimeShift buffer significantly reduced in SSAI manifest`,
            },
          };
        }
        toleranceValue = maxReduction;
        expectedBehavior = "decrease_allowed";
        break;
      }

      default:
        toleranceValue = this.config.attributeTolerance[tolerance] || 0.001;
        break;
    }

    // Perform the comparison based on expected behavior
    const diff = Math.abs(srcSeconds - ssaiSeconds);

    if (expectedBehavior === "increase_allowed" && ssaiSeconds >= srcSeconds) {
      return { issue: null }; // Increase is allowed and expected
    } else if (
      expectedBehavior === "decrease_allowed" &&
      ssaiSeconds <= srcSeconds &&
      diff <= toleranceValue
    ) {
      return { issue: null }; // Controlled decrease is allowed
    } else if (expectedBehavior === "flexible" && diff <= toleranceValue) {
      return { issue: null }; // Within flexible tolerance
    } else if (diff <= toleranceValue) {
      return { issue: null }; // Within normal tolerance
    }

    // Generate issue if outside tolerance
    const severity = critical ? "HIGH" : "MEDIUM";
    return {
      issue: {
        type: "ATTRIBUTE_TOLERANCE_EXCEEDED",
        tag: "MPD",
        attribute: attributeName,
        sourceValue: `${srcSeconds.toFixed(3)}s`,
        ssaiValue: `${ssaiSeconds.toFixed(3)}s`,
        solution: `Adjust ${attributeName} in SSAI manifest - difference of ${diff.toFixed(
          3
        )}s exceeds ${isLive ? "live" : "VOD"} tolerance`,
        severity: severity,
        message: `${attributeName} difference (${diff.toFixed(3)}s) exceeds ${
          isLive ? "live" : "VOD"
        } tolerance`,
      },
    };
  }

  compareTimestamps(sourceValue, ssaiValue, tolerance, critical) {
    try {
      const srcTime = new Date(sourceValue);
      const ssaiTime = new Date(ssaiValue);
      const diffMs = Math.abs(srcTime.getTime() - ssaiTime.getTime());
      const toleranceMs =
        (this.config.ssaiRules.liveTolerances[tolerance] || 1.0) * 1000;

      if (diffMs > toleranceMs) {
        return {
          issue: {
            type: "TIMESTAMP_DRIFT",
            tag: "MPD",
            attribute: "availabilityStartTime",
            sourceValue: sourceValue,
            ssaiValue: ssaiValue,
            solution: `Synchronize availabilityStartTime - ${diffMs}ms drift exceeds ${toleranceMs}ms tolerance`,
            severity: critical ? "HIGH" : "MEDIUM",
            message: `availabilityStartTime drift of ${diffMs}ms exceeds tolerance for live streams`,
          },
        };
      }
    } catch (error) {
      return {
        issue: {
          type: "INVALID_TIMESTAMP",
          tag: "MPD",
          attribute: "availabilityStartTime",
          sourceValue: sourceValue,
          ssaiValue: ssaiValue,
          solution: "Fix timestamp format - should be valid ISO 8601 datetime",
          severity: "HIGH",
          message: `Invalid timestamp format in availabilityStartTime`,
        },
      };
    }

    return { issue: null };
  }

  async performComprehensiveValidation(sourceManifest, ssaiManifest) {
    try {
      // Parse XML manifests to objects for comprehensive validation
      const sourceMPD = this.parseManifestToObject(sourceManifest);
      const ssaiMPD = this.parseManifestToObject(ssaiManifest);

      const validationResults = await this.validator.validate(
        sourceMPD,
        ssaiMPD
      );

      // Convert validation results to the expected format for the UI
      const differences = [];

      // Process errors
      validationResults.errors.forEach((error) => {
        differences.push({
          type: this.mapSeverityToType(error.severity),
          tag: error.rule || error.periodId || "MPD",
          attribute: error.attribute || "",
          sourceValue: error.expected || "",
          ssaiValue: error.actual || "",
          solution: this.generateSolution(error),
          severity: error.severity,
          message: error.message,
          impact: error.impact,
        });
      });

      // Process warnings
      validationResults.warnings.forEach((warning) => {
        differences.push({
          type: this.mapSeverityToType(warning.severity),
          tag: warning.rule || warning.periodId || "MPD",
          attribute: warning.attribute || "",
          sourceValue: warning.expected || "",
          ssaiValue: warning.actual || "",
          solution: this.generateSolution(warning),
          severity: warning.severity,
          message: warning.message,
          impact: warning.impact,
        });
      });

      // Add summary information
      if (validationResults.summary) {
        differences.unshift({
          type: "SUMMARY",
          tag: "Validation Summary",
          attribute: "",
          sourceValue: `Total Issues: ${validationResults.summary.totalIssues}`,
          ssaiValue: `Critical: ${validationResults.summary.criticalIssues}`,
          solution: validationResults.summary.isValid
            ? "SSAI manifest is valid for playback"
            : "Review and fix critical issues before deployment",
          severity: validationResults.summary.isValid ? "INFO" : "VERY_HIGH",
          message: `Validation completed. Ad periods detected: ${validationResults.summary.adPeriodsDetected}`,
          summary: validationResults.summary,
        });
      }

      return differences;
    } catch (error) {
      console.error("Comprehensive validation error:", error);
      return [
        {
          type: "ERROR",
          tag: "Comprehensive Validation",
          attribute: "",
          sourceValue: "",
          ssaiValue: "",
          solution: "Check manifest format and try again",
          severity: "MEDIUM",
          message: `Comprehensive validation failed: ${error.message}`,
        },
      ];
    }
  }

  parseManifestToObject(xmlDoc) {
    const mpd = xmlDoc.querySelector("MPD");
    if (!mpd) return {};

    const mpdObj = {
      // Root attributes
      type: mpd.getAttribute("type"),
      mediaPresentationDuration: mpd.getAttribute("mediaPresentationDuration"),
      minBufferTime: mpd.getAttribute("minBufferTime"),
      profiles: mpd.getAttribute("profiles"),
      availabilityStartTime: mpd.getAttribute("availabilityStartTime"),
      publishTime: mpd.getAttribute("publishTime"),
      minimumUpdatePeriod: mpd.getAttribute("minimumUpdatePeriod"),
      timeShiftBufferDepth: mpd.getAttribute("timeShiftBufferDepth"),
      suggestedPresentationDelay: mpd.getAttribute(
        "suggestedPresentationDelay"
      ),
      maxSegmentDuration: mpd.getAttribute("maxSegmentDuration"),
    };

    // Parse BaseURL
    const baseURL = xmlDoc.querySelector("BaseURL");
    if (baseURL) {
      mpdObj.BaseURL = baseURL.textContent;
    }

    // Parse Location elements
    const locations = xmlDoc.querySelectorAll("Location");
    if (locations.length > 0) {
      mpdObj.Location = Array.from(locations).map((loc) => loc.textContent);
    }

    // Parse PatchLocation elements
    const patchLocations = xmlDoc.querySelectorAll("PatchLocation");
    if (patchLocations.length > 0) {
      mpdObj.PatchLocation = Array.from(patchLocations).map(
        (loc) => loc.textContent
      );
    }

    // Parse UTCTiming
    const utcTiming = xmlDoc.querySelector("UTCTiming");
    if (utcTiming) {
      mpdObj.UTCTiming = {
        schemeIdUri: utcTiming.getAttribute("schemeIdUri"),
        value: utcTiming.getAttribute("value"),
      };
    }

    // Parse ServiceDescription
    const serviceDesc = xmlDoc.querySelector("ServiceDescription");
    if (serviceDesc) {
      mpdObj.ServiceDescription = this.parseServiceDescription(serviceDesc);
    }

    // Parse Periods
    const periods = xmlDoc.querySelectorAll("Period");
    if (periods.length > 0) {
      mpdObj.Period = Array.from(periods).map((period) =>
        this.parsePeriod(period)
      );
    }

    return mpdObj;
  }

  parseServiceDescription(serviceDesc) {
    const service = {};

    const latency = serviceDesc.querySelector("Latency");
    if (latency) {
      service.Latency = {
        target: parseInt(latency.getAttribute("target")),
        max: parseInt(latency.getAttribute("max")),
        min: parseInt(latency.getAttribute("min")),
      };
    }

    const playbackRate = serviceDesc.querySelector("PlaybackRate");
    if (playbackRate) {
      service.PlaybackRate = {
        max: parseFloat(playbackRate.getAttribute("max")),
        min: parseFloat(playbackRate.getAttribute("min")),
      };
    }

    return service;
  }

  parsePeriod(period) {
    const periodObj = {
      id: period.getAttribute("id"),
      start: period.getAttribute("start"),
      duration: period.getAttribute("duration"),
    };

    // Parse AssetIdentifier
    const assetId = period.querySelector("AssetIdentifier");
    if (assetId) {
      periodObj.AssetIdentifier = {
        schemeIdUri: assetId.getAttribute("schemeIdUri"),
        value: assetId.getAttribute("value"),
      };
    }

    // Parse EventStreams
    const eventStreams = period.querySelectorAll("EventStream");
    if (eventStreams.length > 0) {
      periodObj.EventStream = Array.from(eventStreams).map((es) =>
        this.parseEventStream(es)
      );
    }

    // Parse InbandEventStreams
    const inbandEventStreams = period.querySelectorAll("InbandEventStream");
    if (inbandEventStreams.length > 0) {
      periodObj.InbandEventStream = Array.from(inbandEventStreams).map(
        (ies) => ({
          schemeIdUri: ies.getAttribute("schemeIdUri"),
          value: ies.getAttribute("value"),
        })
      );
    }

    // Parse AdaptationSets
    const adaptationSets = period.querySelectorAll("AdaptationSet");
    if (adaptationSets.length > 0) {
      periodObj.AdaptationSet = Array.from(adaptationSets).map((as) =>
        this.parseAdaptationSet(as)
      );
    }

    // Parse Roles, EssentialProperty, SupplementalProperty
    periodObj.Role = this.parseDescriptors(period, "Role");
    periodObj.EssentialProperty = this.parseDescriptors(
      period,
      "EssentialProperty"
    );
    periodObj.SupplementalProperty = this.parseDescriptors(
      period,
      "SupplementalProperty"
    );

    return periodObj;
  }

  parseEventStream(eventStream) {
    const es = {
      schemeIdUri: eventStream.getAttribute("schemeIdUri"),
      value: eventStream.getAttribute("value"),
      timescale: parseInt(eventStream.getAttribute("timescale")) || 1,
    };

    const events = eventStream.querySelectorAll("Event");
    if (events.length > 0) {
      es.Event = Array.from(events).map((event) => ({
        id: event.getAttribute("id"),
        presentationTime: parseInt(event.getAttribute("presentationTime")) || 0,
        duration: parseInt(event.getAttribute("duration")),
        messageData: event.textContent,
      }));
    }

    return es;
  }

  parseAdaptationSet(adaptationSet) {
    const as = {
      id: adaptationSet.getAttribute("id"),
      mimeType: adaptationSet.getAttribute("mimeType"),
      codecs: adaptationSet.getAttribute("codecs"),
      contentType: adaptationSet.getAttribute("contentType"),
      lang: adaptationSet.getAttribute("lang"),
      segmentAlignment:
        adaptationSet.getAttribute("segmentAlignment") === "true",
      Label: adaptationSet.getAttribute("Label"),
    };

    // Parse AudioChannelConfiguration
    const audioChannel = adaptationSet.querySelector(
      "AudioChannelConfiguration"
    );
    if (audioChannel) {
      as.AudioChannelConfiguration = {
        schemeIdUri: audioChannel.getAttribute("schemeIdUri"),
        value: audioChannel.getAttribute("value"),
      };
    }

    // Parse ContentProtection
    const contentProtections =
      adaptationSet.querySelectorAll("ContentProtection");
    if (contentProtections.length > 0) {
      as.ContentProtection = Array.from(contentProtections).map((cp) => ({
        schemeIdUri: cp.getAttribute("schemeIdUri"),
        value: cp.getAttribute("value"),
        default_KID: cp.getAttribute("cenc:default_KID"),
        pssh: cp.querySelector("cenc\\:pssh, pssh")?.textContent,
      }));
    }

    // Parse SegmentTemplate
    const segmentTemplate = adaptationSet.querySelector("SegmentTemplate");
    if (segmentTemplate) {
      as.SegmentTemplate = this.parseSegmentTemplate(segmentTemplate);
    }

    // Parse Representations
    const representations = adaptationSet.querySelectorAll("Representation");
    if (representations.length > 0) {
      as.Representation = Array.from(representations).map((rep) =>
        this.parseRepresentation(rep)
      );
    }

    // Parse descriptors
    as.Role = this.parseDescriptors(adaptationSet, "Role");
    as.Accessibility = this.parseDescriptors(adaptationSet, "Accessibility");
    as.EssentialProperty = this.parseDescriptors(
      adaptationSet,
      "EssentialProperty"
    );
    as.SupplementalProperty = this.parseDescriptors(
      adaptationSet,
      "SupplementalProperty"
    );

    return as;
  }

  parseRepresentation(representation) {
    const rep = {
      id: representation.getAttribute("id"),
      bandwidth: parseInt(representation.getAttribute("bandwidth")),
      width: parseInt(representation.getAttribute("width")),
      height: parseInt(representation.getAttribute("height")),
      codecs: representation.getAttribute("codecs"),
      frameRate: representation.getAttribute("frameRate"),
      audioSamplingRate: parseInt(
        representation.getAttribute("audioSamplingRate")
      ),
      sar: representation.getAttribute("sar"),
    };

    // Parse SegmentTemplate
    const segmentTemplate = representation.querySelector("SegmentTemplate");
    if (segmentTemplate) {
      rep.SegmentTemplate = this.parseSegmentTemplate(segmentTemplate);
    }

    return rep;
  }

  parseSegmentTemplate(segmentTemplate) {
    const template = {
      timescale: parseInt(segmentTemplate.getAttribute("timescale")) || 1,
      duration: parseInt(segmentTemplate.getAttribute("duration")),
      startNumber: parseInt(segmentTemplate.getAttribute("startNumber")) || 1,
      media: segmentTemplate.getAttribute("media"),
      initialization: segmentTemplate.getAttribute("initialization"),
    };

    // Parse SegmentTimeline
    const timeline = segmentTemplate.querySelector("SegmentTimeline");
    if (timeline) {
      const sElements = timeline.querySelectorAll("S");
      template.SegmentTimeline = {
        S: Array.from(sElements).map((s) => ({
          t: parseInt(s.getAttribute("t")),
          d: parseInt(s.getAttribute("d")),
          r: parseInt(s.getAttribute("r")),
        })),
      };
    }

    return template;
  }

  parseDescriptors(element, tagName) {
    const descriptors = element.querySelectorAll(tagName);
    if (descriptors.length === 0) return null;

    return Array.from(descriptors).map((desc) => ({
      schemeIdUri: desc.getAttribute("schemeIdUri"),
      value: desc.getAttribute("value"),
    }));
  }

  mapSeverityToType(severity) {
    switch (severity) {
      case "VERY_HIGH":
        return "CRITICAL ERROR";
      case "HIGH":
        return "ERROR";
      case "MEDIUM":
        return "WARNING";
      case "LOW":
        return "INFO";
      case "INFO":
        return "INFO";
      default:
        return "UNKNOWN";
    }
  }

  generateSolution(issue) {
    if (issue.solution) return issue.solution;

    // Enhanced solution generation based on issue type and context
    const message = issue.message.toLowerCase();
    const severity = issue.severity;

    // Critical SSAI-specific solutions
    if (message.includes("missing") && message.includes("period")) {
      return "Verify SSAI period mapping - content periods may have been incorrectly removed or merged during ad insertion";
    } else if (
      message.includes("missing") &&
      message.includes("adaptationset")
    ) {
      return "Add missing AdaptationSet to SSAI manifest - essential for multi-track playback (video/audio/subtitles)";
    } else if (
      message.includes("missing") &&
      message.includes("representation")
    ) {
      return "Restore missing representation to maintain ABR ladder quality options for adaptive streaming";
    } else if (
      message.includes("drm") ||
      message.includes("contentprotection")
    ) {
      return "Ensure all DRM systems and encryption keys are properly configured in SSAI manifest - critical for protected content playback";
    } else if (message.includes("timescale")) {
      return "Fix timescale mismatch - all timing calculations depend on consistent timescale values between source and SSAI";
    } else if (message.includes("timeline") && message.includes("gap")) {
      return "Fix timeline continuity - gaps will cause playback interruptions and seeking issues";
    } else if (message.includes("timeline") && message.includes("overlap")) {
      return "Fix timeline overlap - will cause duplicate content and playback errors";
    } else if (message.includes("bandwidth")) {
      return "Verify bandwidth values match source - incorrect values affect ABR switching decisions";
    } else if (message.includes("codec")) {
      return "Ensure codec compatibility - codec mismatches prevent playback on some devices";
    } else if (message.includes("duration") && severity === "VERY_HIGH") {
      return "Critical duration mismatch - verify content integrity and ad insertion timing";
    } else if (message.includes("utctiming")) {
      return "Add UTCTiming element for live streams - required for proper clock synchronization and ad boundary accuracy";
    } else if (message.includes("eventstrea")) {
      return "Verify event stream handling - SCTE-35 and ad signaling events may have been incorrectly processed";
    } else if (message.includes("audio") && message.includes("channel")) {
      return "Fix audio channel configuration - mismatches cause audio playback issues and device compatibility problems";
    } else if (message.includes("essential") && message.includes("property")) {
      return "Restore EssentialProperty - players MUST understand these properties for compliant playback";
    } else if (message.includes("accessibility")) {
      return "Restore accessibility features - removal may violate accessibility compliance requirements";
    } else if (message.includes("segment") && message.includes("template")) {
      return "Fix SegmentTemplate structure - required for proper segment URL construction and playback";
    } else if (message.includes("pssh")) {
      return "Verify PSSH data integrity - DRM initialization data must be identical for successful license acquisition";
    } else if (message.includes("framerate")) {
      return "Ensure frame rate consistency - mismatches cause playback quality issues and device compatibility problems";
    } else if (
      message.includes("resolution") ||
      message.includes("width") ||
      message.includes("height")
    ) {
      return "Verify video resolution parameters - incorrect values affect quality selection and display";
    } else if (message.includes("language") || message.includes("lang")) {
      return "Fix language code format - should follow RFC 5646 standard for proper language selection";
    } else if (message.includes("role")) {
      return "Ensure role descriptors match - affects track selection and accessibility features";
    } else if (message.includes("buffer")) {
      return "Adjust buffer time settings - insufficient buffering may cause rebuffering during ad transitions";
    } else if (message.includes("location")) {
      return "Verify manifest update URLs - required for live stream manifest refresh mechanism";
    } else if (message.includes("service") && message.includes("description")) {
      return "Review ServiceDescription changes - may affect low-latency streaming expectations";
    }

    // Severity-based fallback solutions
    if (severity === "VERY_HIGH") {
      return "CRITICAL: This issue will likely cause playback failure - immediate fix required before deployment";
    } else if (severity === "HIGH") {
      return "HIGH PRIORITY: This issue may cause playback problems on some devices or conditions - should be fixed";
    } else if (severity === "MEDIUM") {
      return "MEDIUM: This issue may affect user experience or compatibility - recommended to fix";
    } else if (severity === "LOW") {
      return "LOW: This is a minor issue or best practice recommendation - fix when convenient";
    }

    // Generic fallback solutions
    if (message.includes("missing")) {
      return "Add the missing element or attribute to the SSAI manifest to maintain compatibility with source";
    } else if (message.includes("mismatch")) {
      return "Update the SSAI manifest to match the source value or verify if the difference is intentional for SSAI processing";
    } else if (message.includes("removed")) {
      return "Verify if the removal is intentional for SSAI processing or if the element should be preserved";
    } else {
      return "Review the issue details and update the SSAI manifest to ensure compatibility and compliance";
    }
  }

  // Helper methods for enhanced comparison

  ensureArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  // Enhanced method to get nested values with type handling
  getNestedValue(obj, path) {
    const value = path.split(".").reduce((current, key) => current?.[key], obj);

    // Handle typed values from enhanced extraction
    if (
      value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "parsed")
    ) {
      return value.parsed !== null ? value.parsed : value.raw;
    }

    return value;
  }

  // Enhanced method to get raw values for display
  getNestedRawValue(obj, path) {
    const value = path.split(".").reduce((current, key) => current?.[key], obj);

    // Handle typed values from enhanced extraction
    if (
      value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "raw")
    ) {
      return value.raw;
    }

    return value;
  }

  // Enhanced method to handle numeric comparisons properly
  parseNumericValue(value) {
    // Handle typed values from enhanced extraction
    if (
      value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "parsed")
    ) {
      return value.parsed;
    }

    // Handle legacy string values
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }

    return typeof value === "number" ? value : null;
  }

  // Enhanced method to handle duration values properly
  parseDurationToSeconds(duration) {
    // Handle typed values from enhanced extraction
    if (
      duration &&
      typeof duration === "object" &&
      Object.prototype.hasOwnProperty.call(duration, "parsed")
    ) {
      return duration.parsed;
    }

    // Handle legacy string values
    if (!duration || typeof duration !== "string") return null;

    // Handle numeric values (assume seconds)
    if (/^\d+(\.\d+)?$/.test(duration)) {
      return parseFloat(duration);
    }

    // Parse ISO 8601 duration format (PT1H30M45S)
    const regex =
      /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/;
    const matches = duration.match(regex);

    if (!matches) return null;

    const hours = parseFloat(matches[1] || 0);
    const minutes = parseFloat(matches[2] || 0);
    const seconds = parseFloat(matches[3] || 0);

    return hours * 3600 + minutes * 60 + seconds;
  }

  // Enhanced method to handle URL resolution
  resolveUrl(url, baseUrl) {
    if (!url) return url;

    // Handle typed values from enhanced extraction
    if (
      url &&
      typeof url === "object" &&
      Object.prototype.hasOwnProperty.call(url, "resolved")
    ) {
      return url.resolved || url.raw;
    }

    // Handle legacy string values
    if (typeof url === "string") {
      if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("//")
      ) {
        return url;
      }

      if (baseUrl) {
        try {
          return new URL(url, baseUrl).href;
        } catch (error) {
          console.warn("Failed to resolve URL:", url, error);
          return url;
        }
      }
    }

    return url;
  }

  inferContentType(mimeType) {
    if (!mimeType) return "unknown";
    if (mimeType.includes("video")) return "video";
    if (mimeType.includes("audio")) return "audio";
    if (mimeType.includes("text") || mimeType.includes("application"))
      return "text";
    return "unknown";
  }

  extractRole(roleDescriptors) {
    if (!roleDescriptors) return "main";
    const roles = this.ensureArray(roleDescriptors);
    if (roles.length === 0) return "main";
    return roles
      .map((r) => r.value || "main")
      .sort()
      .join(",");
  }

  normalizeCodecs(codecs) {
    if (!codecs) return "unknown";
    // Extract base codec without profile/level details
    return codecs.split(".")[0].toLowerCase();
  }

  getDefaultTimescale(context) {
    if (context.includes("video")) return this.config.defaultTimescales.video;
    if (context.includes("audio")) return this.config.defaultTimescales.audio;
    if (context.includes("text")) return this.config.defaultTimescales.text;
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

  validateMultipleTimelines(
    sourceTimeline,
    ssaiTimeline,
    srcTimescale,
    ssaiTimescale,
    context
  ) {
    const differences = [];

    const sourceSElements = this.ensureArray(sourceTimeline.S);
    const ssaiSElements = this.ensureArray(ssaiTimeline.S);

    // Compare timeline segment counts
    if (sourceSElements.length !== ssaiSElements.length) {
      differences.push({
        type: "TIMELINE_SEGMENT_COUNT",
        tag: `SegmentTimeline (${context})`,
        attribute: "S elements",
        sourceValue: sourceSElements.length.toString(),
        ssaiValue: ssaiSElements.length.toString(),
        solution: "Ensure segment timeline has matching number of S elements",
        severity: "HIGH",
        message: `Timeline segment count mismatch in ${context}`,
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
          type: "TIMELINE_DURATION_MISMATCH",
          tag: `SegmentTimeline S[${i}] (${context})`,
          attribute: "d",
          sourceValue: `${srcDuration.toFixed(3)}s`,
          ssaiValue: `${ssaiDuration.toFixed(3)}s`,
          solution: "Adjust segment duration to match source timeline",
          severity: "HIGH",
          message: `Timeline segment ${i} duration mismatch: ${durationDiff.toFixed(
            3
          )}s difference`,
        });
      }
    }

    return differences;
  }

  validateSegmentAvailability(sourceMPD, ssaiMPD) {
    const differences = [];

    // Check timeShiftBufferDepth for live streams
    if (sourceMPD.timeShiftBufferDepth && ssaiMPD.timeShiftBufferDepth) {
      const srcDepth = this.parseDurationToSeconds(
        sourceMPD.timeShiftBufferDepth
      );
      const ssaiDepth = this.parseDurationToSeconds(
        ssaiMPD.timeShiftBufferDepth
      );

      if (srcDepth && ssaiDepth && ssaiDepth < srcDepth * 0.9) {
        differences.push({
          type: "TIMESHIFT_BUFFER_REDUCED",
          tag: "MPD",
          attribute: "timeShiftBufferDepth",
          sourceValue: `${srcDepth.toFixed(1)}s`,
          ssaiValue: `${ssaiDepth.toFixed(1)}s`,
          solution:
            "Increase timeShiftBufferDepth in SSAI manifest to match source",
          severity: "HIGH",
          message: "TimeShift buffer significantly reduced in SSAI manifest",
        });
      }
    }

    return differences;
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
    const segmentTemplate = xml?.querySelector("SegmentTemplate");
    return segmentTemplate
      ? parseInt(segmentTemplate.getAttribute("timescale")) || 90000
      : 90000;
  }

  getSegmentTimings(xml) {
    const timeline = xml?.querySelector("SegmentTimeline");
    if (!timeline) return [];

    const times = [];
    const sElems = timeline.querySelectorAll("S");
    const timescale = this.getTimescale(xml);
    let currentTime = 0;

    sElems.forEach((s) => {
      const d = parseInt(s.getAttribute("d")) / timescale;
      const r = parseInt(s.getAttribute("r") || "0");
      const t = s.getAttribute("t")
        ? parseInt(s.getAttribute("t")) / timescale
        : null;

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

  // Enhanced helper methods for robust validation

  compareWithTolerance(sourceValue, ssaiValue, type, tolerance) {
    let srcNum, ssaiNum;

    if (type === "duration") {
      srcNum = this.parseDurationToSeconds(sourceValue);
      ssaiNum = this.parseDurationToSeconds(ssaiValue);
    } else if (type === "numeric") {
      srcNum = parseFloat(sourceValue);
      ssaiNum = parseFloat(ssaiValue);
    } else {
      // String comparison
      return {
        mismatch: sourceValue !== ssaiValue,
        sourceFormatted: sourceValue,
        ssaiFormatted: ssaiValue,
        difference: sourceValue !== ssaiValue ? "Values differ" : "Match",
        severity: sourceValue !== ssaiValue ? "MEDIUM" : "INFO",
      };
    }

    if (
      srcNum === null ||
      ssaiNum === null ||
      isNaN(srcNum) ||
      isNaN(ssaiNum)
    ) {
      return {
        mismatch: true,
        sourceFormatted: sourceValue,
        ssaiFormatted: ssaiValue,
        difference: "Invalid numeric values",
        severity: "HIGH",
      };
    }

    const diff = Math.abs(srcNum - ssaiNum);
    const relativeDiff = srcNum > 0 ? diff / srcNum : diff;
    const exceedsTolerance = diff > tolerance && relativeDiff > 0.01; // 1% relative tolerance

    return {
      mismatch: exceedsTolerance,
      sourceFormatted:
        type === "duration" ? `${srcNum.toFixed(3)}s` : srcNum.toString(),
      ssaiFormatted:
        type === "duration" ? `${ssaiNum.toFixed(3)}s` : ssaiNum.toString(),
      difference: `${diff.toFixed(3)} (${(relativeDiff * 100).toFixed(1)}%)`,
      severity:
        relativeDiff > 0.1 ? "HIGH" : relativeDiff > 0.05 ? "MEDIUM" : "LOW",
    };
  }

  findSemanticPeriodMatch(sourcePeriod, ssaiPeriods) {
    if (!sourcePeriod) return null;

    // Try ID match first
    if (sourcePeriod.id) {
      const idMatch = ssaiPeriods.find((p) => p && p.id === sourcePeriod.id);
      if (idMatch) return idMatch;
    }

    // Try timing-based match
    const sourceStart = this.parseDurationToSeconds(sourcePeriod.start) || 0;
    return ssaiPeriods.find((p) => {
      if (!p) return false;
      const ssaiStart = this.parseDurationToSeconds(p.start) || 0;
      return Math.abs(sourceStart - ssaiStart) < 0.1; // 100ms tolerance
    });
  }

  findSemanticAdaptationSetMatch(srcAS, ssaiASArray) {
    if (!srcAS || !Array.isArray(ssaiASArray)) return null;

    // Create semantic signature for matching
    const srcSignature = this.getAdaptationSetSignature(srcAS);

    return ssaiASArray.find((ssaiAS) => {
      if (!ssaiAS) return false;
      const ssaiSignature = this.getAdaptationSetSignature(ssaiAS);
      return this.signaturesMatch(srcSignature, ssaiSignature);
    });
  }

  findSemanticRepresentationMatch(srcRep, ssaiRepArray) {
    if (!srcRep || !Array.isArray(ssaiRepArray)) return null;

    // Try bandwidth-based matching first (most reliable)
    if (srcRep.bandwidth) {
      const bandwidthMatch = ssaiRepArray.find((ssaiRep) => {
        if (!ssaiRep || !ssaiRep.bandwidth) return false;
        const bandwidthDiff = Math.abs(
          parseInt(srcRep.bandwidth) - parseInt(ssaiRep.bandwidth)
        );
        const tolerance = parseInt(srcRep.bandwidth) * 0.05; // 5% tolerance
        return bandwidthDiff <= tolerance;
      });
      if (bandwidthMatch) return bandwidthMatch;
    }

    // Try resolution-based matching for video
    if (srcRep.width && srcRep.height) {
      const resolutionMatch = ssaiRepArray.find((ssaiRep) => {
        return (
          ssaiRep &&
          ssaiRep.width === srcRep.width &&
          ssaiRep.height === srcRep.height
        );
      });
      if (resolutionMatch) return resolutionMatch;
    }

    // Try ID-based matching
    if (srcRep.id) {
      const idMatch = ssaiRepArray.find(
        (ssaiRep) => ssaiRep && ssaiRep.id === srcRep.id
      );
      if (idMatch) return idMatch;
    }

    return null;
  }

  getAdaptationSetSignature(adaptationSet) {
    return {
      contentType:
        adaptationSet.contentType ||
        this.inferContentType(adaptationSet.mimeType),
      mimeType: adaptationSet.mimeType || "",
      codecs: this.normalizeCodecs(adaptationSet.codecs) || "",
      lang: adaptationSet.lang || "und",
      role: this.extractRole(adaptationSet.Role) || "main",
    };
  }

  getRepresentationSignature(representation) {
    return {
      bandwidth: representation.bandwidth || "",
      width: representation.width || "",
      height: representation.height || "",
      codecs: representation.codecs || "",
      frameRate: representation.frameRate || "",
      audioSamplingRate: representation.audioSamplingRate || "",
    };
  }

  signaturesMatch(sig1, sig2) {
    // Core attributes must match exactly
    if (sig1.contentType !== sig2.contentType) return false;
    if (sig1.lang !== sig2.lang) return false;
    if (sig1.role !== sig2.role) return false;

    // Codecs can have some flexibility (base codec must match)
    const codec1Base = (sig1.codecs || "").split(".")[0];
    const codec2Base = (sig2.codecs || "").split(".")[0];
    if (codec1Base && codec2Base && codec1Base !== codec2Base) return false;

    return true;
  }

  validateAdaptationSetSemantics(srcAS, ssaiAS, periodIndex, asIndex) {
    const differences = [];
    const context = `Period[${periodIndex}].AdaptationSet[${asIndex}]`;

    // Critical semantic attributes
    const criticalAttrs = ["contentType", "mimeType", "lang"];
    criticalAttrs.forEach((attr) => {
      if (srcAS[attr] && srcAS[attr] !== ssaiAS[attr]) {
        differences.push({
          type: "SEMANTIC_MISMATCH",
          tag: context,
          attribute: attr,
          sourceValue: srcAS[attr],
          ssaiValue: ssaiAS[attr] || "Missing",
          solution: `Ensure ${attr} matches between source and SSAI`,
          severity: "VERY_HIGH",
          message: `Critical semantic attribute ${attr} mismatch`,
        });
      }
    });

    // Codec validation
    if (srcAS.codecs && ssaiAS.codecs) {
      const srcCodecBase = srcAS.codecs.split(".")[0];
      const ssaiCodecBase = ssaiAS.codecs.split(".")[0];
      if (srcCodecBase !== ssaiCodecBase) {
        differences.push({
          type: "CODEC_FAMILY_MISMATCH",
          tag: context,
          attribute: "codecs",
          sourceValue: srcAS.codecs,
          ssaiValue: ssaiAS.codecs,
          solution: "Ensure codec families match between source and SSAI",
          severity: "VERY_HIGH",
          message: "Codec family mismatch detected",
        });
      }
    }

    return differences;
  }

  validateRepresentationSemantics(
    srcRep,
    ssaiRep,
    periodIndex,
    asIndex,
    repIndex
  ) {
    const differences = [];
    const context = `Period[${periodIndex}].AdaptationSet[${asIndex}].Representation[${repIndex}]`;

    // Bandwidth validation with tolerance
    if (srcRep.bandwidth && ssaiRep.bandwidth) {
      const srcBW = parseInt(srcRep.bandwidth);
      const ssaiBW = parseInt(ssaiRep.bandwidth);
      const bwDiff = Math.abs(srcBW - ssaiBW);
      const bwTolerance = srcBW * 0.05; // 5% tolerance

      if (bwDiff > bwTolerance) {
        differences.push({
          type: "BANDWIDTH_MISMATCH",
          tag: context,
          attribute: "bandwidth",
          sourceValue: `${srcBW}bps`,
          ssaiValue: `${ssaiBW}bps`,
          solution: "Verify bandwidth values match within acceptable tolerance",
          severity: bwDiff > srcBW * 0.1 ? "HIGH" : "MEDIUM",
          message: `Bandwidth difference: ${bwDiff}bps (${(
            (bwDiff / srcBW) *
            100
          ).toFixed(1)}%)`,
        });
      }
    }

    // Resolution validation for video
    if (srcRep.width && srcRep.height) {
      if (srcRep.width !== ssaiRep.width || srcRep.height !== ssaiRep.height) {
        differences.push({
          type: "RESOLUTION_MISMATCH",
          tag: context,
          attribute: "resolution",
          sourceValue: `${srcRep.width}x${srcRep.height}`,
          ssaiValue: `${ssaiRep.width || "?"}x${ssaiRep.height || "?"}`,
          solution: "Ensure video resolution matches between source and SSAI",
          severity: "HIGH",
          message: "Video resolution mismatch",
        });
      }
    }

    // Frame rate validation
    if (srcRep.frameRate && ssaiRep.frameRate) {
      const srcFR = this.parseFrameRate(srcRep.frameRate);
      const ssaiFR = this.parseFrameRate(ssaiRep.frameRate);
      if (srcFR && ssaiFR && Math.abs(srcFR - ssaiFR) > 0.1) {
        differences.push({
          type: "FRAMERATE_MISMATCH",
          tag: context,
          attribute: "frameRate",
          sourceValue: srcRep.frameRate,
          ssaiValue: ssaiRep.frameRate,
          solution: "Ensure frame rate matches between source and SSAI",
          severity: "HIGH",
          message: "Frame rate mismatch",
        });
      }
    }

    return differences;
  }

  validateSegmentTemplateEquivalence(srcTemplate, ssaiTemplate, context) {
    const differences = [];

    // Critical SegmentTemplate attributes
    const criticalAttrs = [
      { name: "timescale", type: "numeric", tolerance: 0 },
      { name: "duration", type: "numeric", tolerance: 0 },
      { name: "startNumber", type: "numeric", tolerance: 0 },
      { name: "presentationTimeOffset", type: "numeric", tolerance: 1 },
      { name: "availabilityTimeOffset", type: "duration", tolerance: 0.001 },
      { name: "availabilityTimeComplete", type: "string", tolerance: 0 },
    ];

    criticalAttrs.forEach(({ name, type, tolerance }) => {
      const srcValue = srcTemplate[name];
      const ssaiValue = ssaiTemplate[name];

      if (srcValue && ssaiValue) {
        const comparison = this.compareWithTolerance(
          srcValue,
          ssaiValue,
          type,
          tolerance
        );
        if (comparison.mismatch) {
          differences.push({
            type: "SEGMENT_TEMPLATE_MISMATCH",
            tag: `SegmentTemplate (${context})`,
            attribute: name,
            sourceValue: comparison.sourceFormatted,
            ssaiValue: comparison.ssaiFormatted,
            solution: `Ensure SegmentTemplate ${name} matches between source and SSAI`,
            severity: comparison.severity,
            message: `SegmentTemplate ${name} mismatch: ${comparison.difference}`,
          });
        }
      } else if (srcValue && !ssaiValue) {
        differences.push({
          type: "SEGMENT_TEMPLATE_MISSING_ATTR",
          tag: `SegmentTemplate (${context})`,
          attribute: name,
          sourceValue: srcValue,
          ssaiValue: "Missing",
          solution: `Add missing ${name} attribute to SSAI SegmentTemplate`,
          severity: "HIGH",
          message: `SegmentTemplate ${name} missing in SSAI`,
        });
      }
    });

    // Validate SegmentTimeline if present
    if (srcTemplate.SegmentTimeline && ssaiTemplate.SegmentTimeline) {
      const timelineValidation = this.validateSegmentTimelineEquivalence(
        srcTemplate.SegmentTimeline,
        ssaiTemplate.SegmentTimeline,
        srcTemplate.timescale || 1,
        ssaiTemplate.timescale || 1,
        context
      );
      differences.push(...timelineValidation);
    }

    return differences;
  }

  validateSegmentTimelineEquivalence(
    srcTimeline,
    ssaiTimeline,
    srcTimescale,
    ssaiTimescale,
    context
  ) {
    const differences = [];

    const srcS = this.ensureArray(srcTimeline.S);
    const ssaiS = this.ensureArray(ssaiTimeline.S);

    if (srcS.length !== ssaiS.length) {
      differences.push({
        type: "SEGMENT_TIMELINE_COUNT_MISMATCH",
        tag: `SegmentTimeline (${context})`,
        attribute: "S_count",
        sourceValue: srcS.length.toString(),
        ssaiValue: ssaiS.length.toString(),
        solution: "Ensure SegmentTimeline has matching number of S elements",
        severity: "HIGH",
        message: "SegmentTimeline S element count mismatch",
      });
    }

    // Validate each S element
    const minLength = Math.min(srcS.length, ssaiS.length);
    for (let i = 0; i < minLength; i++) {
      const srcSElem = srcS[i];
      const ssaiSElem = ssaiS[i];

      if (!srcSElem || !ssaiSElem) continue;

      // Validate duration (d attribute)
      if (srcSElem.d && ssaiSElem.d) {
        const srcDuration = parseInt(srcSElem.d) / srcTimescale;
        const ssaiDuration = parseInt(ssaiSElem.d) / ssaiTimescale;
        const durationDiff = Math.abs(srcDuration - ssaiDuration);

        if (durationDiff > 0.001) {
          // 1ms tolerance
          differences.push({
            type: "SEGMENT_TIMELINE_DURATION_MISMATCH",
            tag: `SegmentTimeline S[${i}] (${context})`,
            attribute: "d",
            sourceValue: `${srcDuration.toFixed(3)}s`,
            ssaiValue: `${ssaiDuration.toFixed(3)}s`,
            solution: "Ensure segment durations match in SegmentTimeline",
            severity: "HIGH",
            message: `Segment ${i} duration mismatch: ${durationDiff.toFixed(
              3
            )}s`,
          });
        }
      }

      // Validate repeat count (r attribute)
      const srcRepeat = parseInt(srcSElem.r || "0");
      const ssaiRepeat = parseInt(ssaiSElem.r || "0");
      if (srcRepeat !== ssaiRepeat) {
        differences.push({
          type: "SEGMENT_TIMELINE_REPEAT_MISMATCH",
          tag: `SegmentTimeline S[${i}] (${context})`,
          attribute: "r",
          sourceValue: srcRepeat.toString(),
          ssaiValue: ssaiRepeat.toString(),
          solution: "Ensure segment repeat counts match in SegmentTimeline",
          severity: "MEDIUM",
          message: `Segment ${i} repeat count mismatch`,
        });
      }
    }

    return differences;
  }

  isSCTE35Event(eventStream) {
    if (!eventStream || !eventStream.schemeIdUri) return false;
    const scheme = eventStream.schemeIdUri.toLowerCase();
    return (
      scheme.includes("scte35") ||
      scheme.includes("scte:35") ||
      scheme.includes("urn:scte")
    );
  }

  findMatchingEvent(srcEvent, ssaiEvents) {
    if (!srcEvent || !Array.isArray(ssaiEvents)) return null;

    return ssaiEvents.find((ssaiEvent) => {
      if (!ssaiEvent) return false;
      return ssaiEvent.schemeIdUri === srcEvent.schemeIdUri;
    });
  }

  validateEventTiming(srcEvent, ssaiEvent, periodIndex, eventIndex) {
    const differences = [];
    const context = `Period[${periodIndex}].EventStream[${eventIndex}]`;

    // Validate timescale
    const srcTimescale = parseInt(srcEvent.timescale || "1");
    const ssaiTimescale = parseInt(ssaiEvent.timescale || "1");
    if (srcTimescale !== ssaiTimescale) {
      differences.push({
        type: "EVENT_TIMESCALE_MISMATCH",
        tag: context,
        attribute: "timescale",
        sourceValue: srcTimescale.toString(),
        ssaiValue: ssaiTimescale.toString(),
        solution: "Ensure EventStream timescales match",
        severity: "HIGH",
        message: "EventStream timescale mismatch",
      });
    }

    // Validate individual events
    const srcEvents = this.ensureArray(srcEvent.Event);
    const ssaiEvents = this.ensureArray(ssaiEvent.Event);

    srcEvents.forEach((srcE, eIndex) => {
      if (!srcE) return;

      const matchingSSAIEvent = ssaiEvents.find((ssaiE) => {
        if (!ssaiE) return false;
        return srcE.id && ssaiE.id && srcE.id === ssaiE.id;
      });

      if (!matchingSSAIEvent) {
        differences.push({
          type: "EVENT_MISSING",
          tag: `${context}.Event[${eIndex}]`,
          attribute: "id",
          sourceValue: srcE.id || "unknown",
          ssaiValue: "Missing",
          solution: "Ensure all events are preserved in SSAI EventStream",
          severity: "HIGH",
          message: "Event missing in SSAI EventStream",
        });
      } else {
        // Validate event timing
        const srcTime = parseInt(srcE.presentationTime || "0") / srcTimescale;
        const ssaiTime =
          parseInt(matchingSSAIEvent.presentationTime || "0") / ssaiTimescale;
        const timeDiff = Math.abs(srcTime - ssaiTime);

        if (timeDiff > 0.1) {
          // 100ms tolerance
          differences.push({
            type: "EVENT_TIMING_DRIFT",
            tag: `${context}.Event[${eIndex}]`,
            attribute: "presentationTime",
            sourceValue: `${srcTime.toFixed(3)}s`,
            ssaiValue: `${ssaiTime.toFixed(3)}s`,
            solution: "Verify event timing alignment in SSAI processing",
            severity: timeDiff > 1.0 ? "HIGH" : "MEDIUM",
            message: `Event timing drift: ${timeDiff.toFixed(3)}s`,
          });
        }
      }
    });

    return differences;
  }

  validateContentProtectionEquivalence(srcCPs, ssaiCPs, context) {
    const differences = [];

    const srcArray = this.ensureArray(srcCPs);
    const ssaiArray = this.ensureArray(ssaiCPs);

    srcArray.forEach((srcCP) => {
      if (!srcCP) return;

      const matchingSSAICP = ssaiArray.find((ssaiCP) => {
        return ssaiCP && ssaiCP.schemeIdUri === srcCP.schemeIdUri;
      });

      if (!matchingSSAICP) {
        differences.push({
          type: "DRM_SYSTEM_MISSING",
          tag: `ContentProtection (${context})`,
          attribute: "schemeIdUri",
          sourceValue: srcCP.schemeIdUri,
          ssaiValue: "Missing",
          solution: "Add missing DRM system to SSAI manifest",
          severity: "VERY_HIGH",
          message: "DRM system missing in SSAI",
        });
        return;
      }

      // Validate DRM attributes
      if (srcCP.value && srcCP.value !== matchingSSAICP.value) {
        differences.push({
          type: "DRM_VALUE_MISMATCH",
          tag: `ContentProtection (${context})`,
          attribute: "value",
          sourceValue: srcCP.value,
          ssaiValue: matchingSSAICP.value || "Missing",
          solution: "Ensure DRM value attribute matches",
          severity: "MEDIUM",
          message: "DRM value attribute mismatch",
        });
      }

      // Validate PSSH data
      if (srcCP.pssh && srcCP.pssh !== matchingSSAICP.pssh) {
        differences.push({
          type: "DRM_PSSH_MISMATCH",
          tag: `ContentProtection (${context})`,
          attribute: "pssh",
          sourceValue: "Present",
          ssaiValue: matchingSSAICP.pssh ? "Different" : "Missing",
          solution: "Ensure PSSH data matches exactly between source and SSAI",
          severity: "VERY_HIGH",
          message: "DRM PSSH data mismatch",
        });
      }

      // Validate default_KID
      if (
        srcCP.default_KID &&
        srcCP.default_KID !== matchingSSAICP.default_KID
      ) {
        differences.push({
          type: "DRM_KID_MISMATCH",
          tag: `ContentProtection (${context})`,
          attribute: "default_KID",
          sourceValue: srcCP.default_KID,
          ssaiValue: matchingSSAICP.default_KID || "Missing",
          solution:
            "Ensure default_KID matches exactly between source and SSAI",
          severity: "VERY_HIGH",
          message: "DRM default_KID mismatch",
        });
      }
    });

    return differences;
  }

  parseFrameRate(frameRate) {
    if (typeof frameRate === "number") return frameRate;
    if (typeof frameRate === "string") {
      if (frameRate.includes("/")) {
        const [num, den] = frameRate.split("/").map(Number);
        return den ? num / den : null;
      }
      return parseFloat(frameRate);
    }
    return null;
  }

  isAdPeriod(period) {
    const p = period.period || period;
    if (!p) return false;

    // Check period ID for ad indicators
    if (p.id) {
      const id = String(p.id).toLowerCase();
      if (
        id.includes("ad") ||
        id.includes("preroll") ||
        id.includes("midroll") ||
        id.includes("postroll")
      ) {
        return true;
      }
    }

    // Check for SSAI-specific markers
    if (p.AssetIdentifier) {
      const scheme = p.AssetIdentifier.schemeIdUri;
      if (scheme && (scheme.includes("ad-id") || scheme.includes("urn:uuid"))) {
        return true;
      }
    }

    return false;
  }

  // Process semantic validation results from ManifestService
  processSemanticValidation(sourceManifest, ssaiManifest) {
    const differences = [];

    try {
      // Parse manifests to get validation data
      const sourceMPD = this.parseManifestToObject(sourceManifest);
      const ssaiMPD = this.parseManifestToObject(ssaiManifest);

      // Process source validation results
      if (sourceMPD._validation) {
        this.processValidationResults(
          sourceMPD._validation,
          "SOURCE",
          differences
        );
      }

      // Process SSAI validation results
      if (ssaiMPD._validation) {
        this.processValidationResults(ssaiMPD._validation, "SSAI", differences);
      }

      // Compare interdependencies between source and SSAI
      if (sourceMPD._validation && ssaiMPD._validation) {
        this.compareInterdependencies(
          sourceMPD._validation.interdependencies,
          ssaiMPD._validation.interdependencies,
          differences
        );
      }
    } catch (error) {
      console.warn("Semantic validation processing failed:", error);
    }

    return differences;
  }

  // Process validation results from ManifestService
  processValidationResults(validation, manifestType, differences) {
    // Process errors
    validation.errors.forEach((error) => {
      differences.push({
        type: error.type || "SEMANTIC_ERROR",
        tag: `${manifestType} Validation`,
        attribute: error.attribute || "",
        sourceValue: manifestType === "SOURCE" ? "Error" : "",
        ssaiValue: manifestType === "SSAI" ? "Error" : "",
        solution: this.generateSemanticSolution(error),
        severity: error.severity || "HIGH",
        message: `${manifestType}: ${error.message}`,
        manifestType,
      });
    });

    // Process warnings
    validation.warnings.forEach((warning) => {
      differences.push({
        type: warning.type || "SEMANTIC_WARNING",
        tag: `${manifestType} Validation`,
        attribute: warning.attribute || "",
        sourceValue: manifestType === "SOURCE" ? "Warning" : "",
        ssaiValue: manifestType === "SSAI" ? "Warning" : "",
        solution: this.generateSemanticSolution(warning),
        severity: warning.severity || "MEDIUM",
        message: `${manifestType}: ${warning.message}`,
        manifestType,
      });
    });
  }

  // Compare interdependencies between source and SSAI
  compareInterdependencies(sourceInterdep, ssaiInterdep, differences) {
    // Compare period continuity
    if (sourceInterdep.periodContinuity && ssaiInterdep.periodContinuity) {
      const srcContinuity = sourceInterdep.periodContinuity;
      const ssaiContinuity = ssaiInterdep.periodContinuity;

      if (srcContinuity.continuityGaps !== ssaiContinuity.continuityGaps) {
        differences.push({
          type: "PERIOD_CONTINUITY_CHANGE",
          tag: "Interdependency",
          attribute: "continuityGaps",
          sourceValue: srcContinuity.continuityGaps.toString(),
          ssaiValue: ssaiContinuity.continuityGaps.toString(),
          solution:
            "Review period continuity changes introduced by SSAI processing",
          severity:
            ssaiContinuity.continuityGaps > srcContinuity.continuityGaps
              ? "HIGH"
              : "MEDIUM",
          message: "Period continuity gaps changed during SSAI processing",
        });
      }
    }

    // Compare timing interdependencies
    if (sourceInterdep.timing && ssaiInterdep.timing) {
      const srcTiming = sourceInterdep.timing;
      const ssaiTiming = ssaiInterdep.timing;

      // Check if buffer time relationships changed
      if (srcTiming.minBufferTime && ssaiTiming.minBufferTime) {
        const bufferChange = Math.abs(
          srcTiming.minBufferTime - ssaiTiming.minBufferTime
        );
        if (bufferChange > 0.1) {
          differences.push({
            type: "BUFFER_TIME_INTERDEPENDENCY_CHANGE",
            tag: "Interdependency",
            attribute: "minBufferTime",
            sourceValue: `${srcTiming.minBufferTime.toFixed(3)}s`,
            ssaiValue: `${ssaiTiming.minBufferTime.toFixed(3)}s`,
            solution:
              "Verify buffer time changes are intentional for SSAI ad transitions",
            severity:
              ssaiTiming.minBufferTime < srcTiming.minBufferTime
                ? "HIGH"
                : "MEDIUM",
            message:
              "Buffer time interdependency changed during SSAI processing",
          });
        }
      }
    }

    // Compare BaseURL interdependencies
    if (sourceInterdep.baseUrls && ssaiInterdep.baseUrls) {
      const srcBaseUrls = sourceInterdep.baseUrls.length;
      const ssaiBaseUrls = ssaiInterdep.baseUrls.length;

      if (srcBaseUrls !== ssaiBaseUrls) {
        differences.push({
          type: "BASEURL_COUNT_CHANGE",
          tag: "Interdependency",
          attribute: "baseUrlCount",
          sourceValue: srcBaseUrls.toString(),
          ssaiValue: ssaiBaseUrls.toString(),
          solution:
            "Review BaseURL changes - may affect segment URL resolution",
          severity: "MEDIUM",
          message: "Number of BaseURLs changed during SSAI processing",
        });
      }
    }
  }

  // Generate solutions for semantic validation issues
  generateSemanticSolution(issue) {
    const type = issue.type?.toLowerCase() || "";
    const message = issue.message?.toLowerCase() || "";

    if (type.includes("period_continuity")) {
      return "Ensure period start times and durations create a continuous timeline without gaps or overlaps";
    } else if (type.includes("buffer_time_conflict")) {
      return "Adjust buffer time relationships - suggestedPresentationDelay should be >= minBufferTime";
    } else if (type.includes("live_timing_conflict")) {
      return "For live streams, timeShiftBufferDepth should be at least 2x minimumUpdatePeriod";
    } else if (type.includes("baseurl_conflict")) {
      return "Remove duplicate BaseURLs or ensure they serve different purposes at different hierarchy levels";
    } else if (type.includes("missing_live_attribute")) {
      return "Add required live streaming attributes for proper dynamic MPD functionality";
    } else if (message.includes("duration mismatch")) {
      return "Verify that sum of period durations matches MPD mediaPresentationDuration";
    } else if (message.includes("semantic validation")) {
      return "Check manifest structure and fix any malformed elements or attributes";
    }

    return issue.solution || "Review and fix the identified semantic issue";
  }

  // Detect attributes and elements that are not covered in our validation
  detectUncoveredAttributes(sourceManifest, ssaiManifest) {
    const uncoveredItems = [];

    if (!sourceManifest || !ssaiManifest) return uncoveredItems;

    try {
      // Get all attributes from both manifests
      const sourceAttributes = this.extractAllAttributes(sourceManifest);
      const ssaiAttributes = this.extractAllAttributes(ssaiManifest);

      // Known attributes that are covered in our validation
      const knownAttributes = new Set([
        "type",
        "mediaPresentationDuration",
        "minBufferTime",
        "profiles",
        "availabilityStartTime",
        "publishTime",
        "minimumUpdatePeriod",
        "timeShiftBufferDepth",
        "suggestedPresentationDelay",
        "UTCTiming",
        "id",
        "start",
        "duration",
        "contentType",
        "mimeType",
        "codecs",
        "lang",
        "segmentAlignment",
        "bandwidth",
        "width",
        "height",
        "frameRate",
        "audioSamplingRate",
        "timescale",
        "startNumber",
        "initialization",
        "media",
        "schemeIdUri",
        "value",
        "pssh",
        "default_KID",
        "Role",
        "Accessibility",
        "Label",
        "AudioChannelConfiguration",
        "Location",
        "PatchLocation",
        "ServiceDescription",
        "EssentialProperty",
        "SupplementalProperty",
        "EventStream",
        "InbandEventStream",
        "ContentProtection",
        "SegmentTemplate",
        "SegmentTimeline",
        "SegmentBase",
        "SegmentList",
        "BaseURL",
      ]);

      // Check for uncovered attributes in source
      sourceAttributes.forEach((attr) => {
        if (!knownAttributes.has(attr.name)) {
          uncoveredItems.push({
            type: "UNCOVERED_ATTRIBUTE",
            tag: attr.element || "Unknown",
            attribute: attr.name,
            sourceValue: attr.value || "Present",
            ssaiValue:
              ssaiAttributes.find((a) => a.name === attr.name)?.value ||
              "Unknown",
            solution:
              "Review this attribute - it may not be covered in current validation logic",
            severity: "NOT_FOUND",
            message: `Attribute "${attr.name}" not covered in validation schema`,
          });
        }
      });

      // Check for uncovered attributes in SSAI
      ssaiAttributes.forEach((attr) => {
        if (
          !knownAttributes.has(attr.name) &&
          !sourceAttributes.find((a) => a.name === attr.name)
        ) {
          uncoveredItems.push({
            type: "NEW_SSAI_ATTRIBUTE",
            tag: attr.element || "Unknown",
            attribute: attr.name,
            sourceValue: "Not Present",
            ssaiValue: attr.value || "Present",
            solution:
              "Review this new SSAI attribute - it may need validation coverage",
            severity: "NOT_FOUND",
            message: `New attribute "${attr.name}" found in SSAI manifest`,
          });
        }
      });
    } catch (error) {
      console.warn("Error detecting uncovered attributes:", error);
    }

    return uncoveredItems;
  }

  // Extract all attributes from a manifest
  extractAllAttributes(manifest) {
    const attributes = [];

    if (!manifest) return attributes;

    try {
      // If it's an XML document, traverse it
      if (
        manifest.nodeType === Node.DOCUMENT_NODE ||
        manifest.nodeType === Node.ELEMENT_NODE
      ) {
        this.traverseXMLForAttributes(manifest, attributes);
      } else if (typeof manifest === "object") {
        // If it's a parsed object, extract attributes
        this.traverseObjectForAttributes(manifest, attributes);
      }
    } catch (error) {
      console.warn("Error extracting attributes:", error);
    }

    return attributes;
  }

  // Traverse XML nodes to find attributes
  traverseXMLForAttributes(node, attributes, elementName = "") {
    if (!node) return;

    // Get element name
    const currentElement = node.nodeName || elementName;

    // Extract attributes from current node
    if (node.attributes) {
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        attributes.push({
          name: attr.name,
          value: attr.value,
          element: currentElement,
        });
      }
    }

    // Recursively traverse child nodes
    if (node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child.nodeType === Node.ELEMENT_NODE) {
          this.traverseXMLForAttributes(child, attributes);
        }
      }
    }
  }

  // Traverse object to find attributes
  traverseObjectForAttributes(obj, attributes, elementName = "MPD") {
    if (!obj || typeof obj !== "object") return;

    Object.keys(obj).forEach((key) => {
      const value = obj[key];

      // Skip certain keys that are not attributes
      if (
        [
          "Period",
          "AdaptationSet",
          "Representation",
          "SegmentTemplate",
          "SegmentTimeline",
        ].includes(key)
      ) {
        // These are elements, traverse them
        if (Array.isArray(value)) {
          value.forEach((item) =>
            this.traverseObjectForAttributes(item, attributes, key)
          );
        } else if (typeof value === "object") {
          this.traverseObjectForAttributes(value, attributes, key);
        }
      } else {
        // This is likely an attribute
        attributes.push({
          name: key,
          value:
            typeof value === "object" ? JSON.stringify(value) : String(value),
          element: elementName,
        });
      }
    });
  }
}
