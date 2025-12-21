const SSAIMPDValidator = {
  validateMPDRoot(sourceMPD, ssaiMPD) {
    const errors = [];
    const warnings = [];
    const durationErrors = []; // Collect duration parsing errors

    const rules = {
      type: {
        severity: "VERY_HIGH",
        validate: () => sourceMPD.type === ssaiMPD.type,
        message: "MPD type mismatch (static/dynamic)",
      },
      mediaPresentationDuration: {
        severity: "VERY_HIGH",
        validate: () => {
          if (!sourceMPD.mediaPresentationDuration) return true;
          const sourceDurationResult = this.parseDuration(
            sourceMPD.mediaPresentationDuration,
            "source mediaPresentationDuration"
          );
          const ssaiDurationResult = this.parseDuration(
            ssaiMPD.mediaPresentationDuration,
            "SSAI mediaPresentationDuration"
          );

          // Collect duration parsing errors
          if (sourceDurationResult.error) {
            durationErrors.push(sourceDurationResult.error);
          }
          if (ssaiDurationResult.error) {
            durationErrors.push(ssaiDurationResult.error);
          }

          if (
            sourceDurationResult.value === null ||
            ssaiDurationResult.value === null
          )
            return true;
          return ssaiDurationResult.value >= sourceDurationResult.value;
        },
        message: "SSAI duration cannot be shorter than source",
      },
      profiles: {
        severity: "HIGH",
        validate: () => {
          if (!sourceMPD.profiles || !ssaiMPD.profiles) return true;
          const sourceProfiles = sourceMPD.profiles
            .split(",")
            .map((p) => p.trim());
          const ssaiProfiles = ssaiMPD.profiles.split(",").map((p) => p.trim());
          return sourceProfiles.every((p) => ssaiProfiles.includes(p));
        },
        message: "SSAI must support all source profiles",
      },
      availabilityStartTime: {
        severity: "VERY_HIGH",
        validate: () => {
          if (sourceMPD.type !== "dynamic") return true;
          if (!sourceMPD.availabilityStartTime) return true;
          const diff = Math.abs(
            new Date(ssaiMPD.availabilityStartTime) -
              new Date(sourceMPD.availabilityStartTime)
          );
          return diff <= 1000;
        },
        message: "availabilityStartTime mismatch exceeds tolerance",
      },
      minBufferTime: {
        severity: "HIGH",
        validate: () => {
          const srcBufferResult = this.parseDuration(
            sourceMPD.minBufferTime,
            "source minBufferTime"
          );
          const ssaiBufferResult = this.parseDuration(
            ssaiMPD.minBufferTime,
            "SSAI minBufferTime"
          );

          // Collect duration parsing errors
          if (srcBufferResult.error) {
            durationErrors.push(srcBufferResult.error);
          }
          if (ssaiBufferResult.error) {
            durationErrors.push(ssaiBufferResult.error);
          }

          if (srcBufferResult.value === null || ssaiBufferResult.value === null)
            return true;
          return ssaiBufferResult.value >= srcBufferResult.value;
        },
        message: "SSAI minBufferTime should not be less than source",
      },
      publishTime: {
        severity: "MEDIUM",
        validate: () => {
          if (!sourceMPD.publishTime) return true;
          return (
            new Date(ssaiMPD.publishTime) >= new Date(sourceMPD.publishTime)
          );
        },
        message: "SSAI publishTime should be >= source",
      },
      minimumUpdatePeriod: {
        severity: "HIGH",
        validate: () => {
          if (sourceMPD.type !== "dynamic") return true;
          if (!sourceMPD.minimumUpdatePeriod) return true;
          return true;
        },
        message: "minimumUpdatePeriod differs (may be intentional)",
      },
      timeShiftBufferDepth: {
        severity: "HIGH",
        validate: () => {
          if (!sourceMPD.timeShiftBufferDepth) return true;
          const srcDepthResult = this.parseDuration(
            sourceMPD.timeShiftBufferDepth,
            "source timeShiftBufferDepth"
          );
          const ssaiDepthResult = this.parseDuration(
            ssaiMPD.timeShiftBufferDepth,
            "SSAI timeShiftBufferDepth"
          );

          // Collect duration parsing errors
          if (srcDepthResult.error) {
            durationErrors.push(srcDepthResult.error);
          }
          if (ssaiDepthResult.error) {
            durationErrors.push(ssaiDepthResult.error);
          }

          if (srcDepthResult.value === null || ssaiDepthResult.value === null)
            return true;
          return ssaiDepthResult.value >= srcDepthResult.value * 0.9;
        },
        message: "timeShiftBufferDepth significantly reduced",
      },
      suggestedPresentationDelay: {
        severity: "MEDIUM",
        validate: () => {
          if (!sourceMPD.suggestedPresentationDelay) return true;
          return (
            sourceMPD.type !== "dynamic" || ssaiMPD.suggestedPresentationDelay
          );
        },
        message: "suggestedPresentationDelay missing for live stream",
      },
    };

    errors.push(...this.executeValidationRules(rules));
    errors.push(...durationErrors); // Add duration parsing errors
    return { errors, warnings };
  },
  validateUTCTiming(sourceMPD, ssaiMPD) {
    const errors = [];
    const warnings = [];
    if (sourceMPD.type === "dynamic") {
      const sourceUTC = sourceMPD.UTCTiming;
      const ssaiUTC = ssaiMPD.UTCTiming;
      if (!sourceUTC) {
        warnings.push({
          severity: "HIGH",
          message: "Source MPD missing UTCTiming for live stream",
          impact: "May cause clock sync issues",
        });
      }
      if (!ssaiUTC) {
        errors.push({
          severity: "VERY_HIGH",
          message: "SSAI MPD missing UTCTiming - clock sync impossible",
          impact: "Will cause ad boundary errors and segment misalignment",
        });
      } else {
        const validSchemes = [
          "urn:mpeg:dash:utc:http-xsdate:2014",
          "urn:mpeg:dash:utc:http-iso:2014",
          "urn:mpeg:dash:utc:http-head:2014",
          "urn:mpeg:dash:utc:ntp:2014",
          "urn:mpeg:dash:utc:direct:2014",
        ];
        if (!validSchemes.includes(ssaiUTC.schemeIdUri)) {
          errors.push({
            severity: "HIGH",
            message: `Invalid UTCTiming scheme: ${ssaiUTC.schemeIdUri}`,
            validSchemes,
          });
        }
        if (!ssaiUTC.value) {
          errors.push({
            severity: "VERY_HIGH",
            message: "UTCTiming missing value (time source URL)",
          });
        }
      }
    }
    return { errors, warnings };
  },
  validateManifestRefresh(ssaiMPD) {
    const errors = [];
    const warnings = [];
    if (ssaiMPD.type === "dynamic") {
      const hasLocation = ssaiMPD.Location && ssaiMPD.Location.length > 0;
      const hasPatchLocation =
        ssaiMPD.PatchLocation && ssaiMPD.PatchLocation.length > 0;
      const hasUpdatePeriod = ssaiMPD.minimumUpdatePeriod;
      if (!hasLocation && !hasPatchLocation && !hasUpdatePeriod) {
        errors.push({
          severity: "VERY_HIGH",
          message:
            "No manifest refresh mechanism (Location/PatchLocation/minimumUpdatePeriod)",
          impact: "Live playback will stall",
        });
      }
      if (hasLocation) {
        const locations = Array.isArray(ssaiMPD.Location)
          ? ssaiMPD.Location
          : [ssaiMPD.Location];
        locations.forEach((loc, index) => {
          if (loc && !this.isValidURL(loc)) {
            errors.push({
              severity: "HIGH",
              message: `Invalid Location URL at index ${index}: ${loc}`,
            });
          }
        });
      }
      if (hasPatchLocation) {
        const patchLocations = Array.isArray(ssaiMPD.PatchLocation)
          ? ssaiMPD.PatchLocation
          : [ssaiMPD.PatchLocation];
        patchLocations.forEach((patchLoc, index) => {
          if (patchLoc && !this.isValidURL(patchLoc)) {
            warnings.push({
              severity: "MEDIUM",
              message: `Invalid PatchLocation URL at index ${index}: ${patchLoc}`,
            });
          }
        });
      }
    }
    return { errors, warnings };
  },
  validateServiceDescription(sourceMPD, ssaiMPD) {
    const errors = [];
    const warnings = [];
    const srcService = sourceMPD.ServiceDescription;
    const ssaiService = ssaiMPD.ServiceDescription;
    if (!srcService) return { errors, warnings };
    if (!ssaiService) {
      warnings.push({
        severity: "MEDIUM",
        message: "ServiceDescription removed by SSAI",
        note: "May affect low-latency playback expectations",
      });
      return { errors, warnings };
    }
    const srcLatency = srcService.Latency;
    const ssaiLatency = ssaiService.Latency;
    if (srcLatency && ssaiLatency) {
      if (srcLatency.max && ssaiLatency.target > srcLatency.max) {
        errors.push({
          severity: "HIGH",
          message: "SSAI latency exceeds source maximum",
          sourceMax: srcLatency.max,
          ssaiTarget: ssaiLatency.target,
        });
      }
      if (ssaiLatency.target > srcLatency.target * 1.5) {
        warnings.push({
          severity: "MEDIUM",
          message: "SSAI significantly increased latency target",
          sourceTarget: srcLatency.target,
          ssaiTarget: ssaiLatency.target,
          increase: `${(
            (ssaiLatency.target / srcLatency.target - 1) *
            100
          ).toFixed(0)}%`,
        });
      }
    }
    const srcPlayback = srcService.PlaybackRate;
    const ssaiPlayback = ssaiService.PlaybackRate;
    if (srcPlayback && ssaiPlayback) {
      if (
        ssaiPlayback.max < srcPlayback.max ||
        ssaiPlayback.min > srcPlayback.min
      ) {
        warnings.push({
          severity: "MEDIUM",
          message: "SSAI restricted playback rate range",
          source: `${srcPlayback.min}-${srcPlayback.max}`,
          ssai: `${ssaiPlayback.min}-${ssaiPlayback.max}`,
        });
      }
    }
    return { errors, warnings };
  },
  validatePeriods(sourcePeriods, ssaiPeriods) {
    const errors = [];
    const warnings = [];
    const sourceArray = Array.isArray(sourcePeriods)
      ? sourcePeriods
      : sourcePeriods
      ? [sourcePeriods]
      : [];
    const ssaiArray = Array.isArray(ssaiPeriods)
      ? ssaiPeriods
      : ssaiPeriods
      ? [ssaiPeriods]
      : [];

    // Enhanced Period-level validation
    const periodValidation = this.validatePeriodStructure(
      sourceArray,
      ssaiArray
    );
    errors.push(...periodValidation.errors);
    warnings.push(...periodValidation.warnings);

    const sourceTimeline = this.buildTimeline(sourceArray);
    const ssaiTimeline = this.buildTimeline(ssaiArray);
    const timelineErrors = this.validateTimelineContinuity(ssaiTimeline);
    errors.push(...timelineErrors);
    const sourceDuration = sourceTimeline.reduce((sum, p) => {
      const dur = p.duration;
      return dur === null ? sum : sum + dur;
    }, 0);
    const ssaiContentDuration = ssaiTimeline
      .filter((p) => !this.isAdPeriod(p))
      .reduce((sum, p) => {
        const dur = p.duration;
        return dur === null ? sum : sum + dur;
      }, 0);
    const durationDiff = Math.abs(sourceDuration - ssaiContentDuration);
    const tolerance = Math.max(sourceDuration * 0.01, 1);
    if (sourceDuration > 0 && durationDiff > tolerance) {
      errors.push({
        severity: "VERY_HIGH",
        message: "Content duration mismatch",
        expected: sourceDuration.toFixed(2),
        actual: ssaiContentDuration.toFixed(2),
        difference: durationDiff.toFixed(2),
      });
    }
    const adPeriods = ssaiTimeline.filter((p) => this.isAdPeriod(p));
    warnings.push({
      severity: "INFO",
      message: `SSAI inserted ${adPeriods.length} ad periods`,
      totalAdDuration: adPeriods
        .reduce((sum, p) => {
          const dur = p.duration;
          return dur === null ? sum : sum + dur;
        }, 0)
        .toFixed(2),
    });
    return { errors, warnings, info: { adPeriods: adPeriods.length } };
  },

  validatePeriodStructure(sourcePeriods, ssaiPeriods) {
    const errors = [];
    const warnings = [];

    // Period count validation
    if (sourcePeriods.length > ssaiPeriods.length) {
      errors.push({
        severity: "VERY_HIGH",
        message: "Missing periods in SSAI manifest",
        expected: sourcePeriods.length,
        actual: ssaiPeriods.length,
        impact: "Content periods may be missing, causing playback gaps",
      });
    }

    // Validate each source period exists in SSAI
    sourcePeriods.forEach((sourcePeriod, index) => {
      if (!sourcePeriod) return;

      // Period ID validation
      if (sourcePeriod.id) {
        const ssaiPeriodWithId = ssaiPeriods.find(
          (p) => p && p.id === sourcePeriod.id
        );
        if (!ssaiPeriodWithId) {
          errors.push({
            severity: "HIGH",
            message: `Period ID missing in SSAI: ${sourcePeriod.id}`,
            periodId: sourcePeriod.id,
            impact: "Period identification may fail",
          });
        }
      }

      // Period start time validation
      if (sourcePeriod.start) {
        const sourceStartResult = this.parseDuration(
          sourcePeriod.start,
          `source period ${sourcePeriod.id || index} start`
        );
        if (sourceStartResult.error) {
          errors.push(sourceStartResult.error);
        } else {
          const matchingSSAIPeriod = this.findMatchingPeriod(
            sourcePeriod,
            ssaiPeriods
          );
          if (matchingSSAIPeriod && matchingSSAIPeriod.start) {
            const ssaiStartResult = this.parseDuration(
              matchingSSAIPeriod.start,
              `SSAI period ${matchingSSAIPeriod.id || "unknown"} start`
            );
            if (ssaiStartResult.error) {
              errors.push(ssaiStartResult.error);
            } else if (
              sourceStartResult.value !== null &&
              ssaiStartResult.value !== null
            ) {
              const startDiff = Math.abs(
                sourceStartResult.value - ssaiStartResult.value
              );
              if (startDiff > 0.1) {
                // 100ms tolerance
                warnings.push({
                  severity: "MEDIUM",
                  message: `Period start time mismatch: ${startDiff.toFixed(
                    3
                  )}s`,
                  periodId: sourcePeriod.id || `index_${index}`,
                  expected: sourceStartResult.value.toFixed(3),
                  actual: ssaiStartResult.value.toFixed(3),
                });
              }
            }
          }
        }
      }

      // Period duration validation
      if (sourcePeriod.duration) {
        const sourceDurationResult = this.parseDuration(
          sourcePeriod.duration,
          `source period ${sourcePeriod.id || index} duration`
        );
        if (sourceDurationResult.error) {
          errors.push(sourceDurationResult.error);
        }
      }
    });

    // Validate SSAI-specific period features
    ssaiPeriods.forEach((ssaiPeriod, index) => {
      if (!ssaiPeriod) return;

      // Check for ad period markers
      if (this.isAdPeriod(ssaiPeriod)) {
        const adValidation = this.validateAdPeriodStructure(ssaiPeriod, index);
        errors.push(...adValidation.errors);
        warnings.push(...adValidation.warnings);
      }
    });

    return { errors, warnings };
  },

  validateAdPeriodStructure(adPeriod, index) {
    const errors = [];
    const warnings = [];

    // Ad period should have duration
    if (!adPeriod.duration) {
      errors.push({
        severity: "HIGH",
        message: `Ad period missing duration`,
        periodId: adPeriod.id || `ad_period_${index}`,
        impact: "Ad duration cannot be determined",
      });
    }

    // Ad period should have proper identification
    if (!adPeriod.id || !adPeriod.id.toLowerCase().includes("ad")) {
      warnings.push({
        severity: "MEDIUM",
        message: `Ad period lacks clear identification`,
        periodId: adPeriod.id || `period_${index}`,
        note: "Consider using descriptive period IDs for ad periods",
      });
    }

    // Validate AssetIdentifier for ad periods
    if (adPeriod.AssetIdentifier) {
      if (
        !adPeriod.AssetIdentifier.schemeIdUri ||
        !adPeriod.AssetIdentifier.value
      ) {
        errors.push({
          severity: "MEDIUM",
          message: `Incomplete AssetIdentifier in ad period`,
          periodId: adPeriod.id || `ad_period_${index}`,
          impact: "Ad tracking may be affected",
        });
      }
    }

    return { errors, warnings };
  },
  validateEventStreams(sourcePeriod, ssaiPeriod) {
    const errors = [];
    const warnings = [];
    const sourceEvents = Array.isArray(sourcePeriod.EventStream)
      ? sourcePeriod.EventStream
      : sourcePeriod.EventStream
      ? [sourcePeriod.EventStream]
      : [];
    const ssaiEvents = Array.isArray(ssaiPeriod.EventStream)
      ? ssaiPeriod.EventStream
      : ssaiPeriod.EventStream
      ? [ssaiPeriod.EventStream]
      : [];
    sourceEvents.forEach((srcEvent) => {
      if (!srcEvent) return;
      const scheme = srcEvent.schemeIdUri;
      const ssaiEvent = ssaiEvents.find((e) => e && e.schemeIdUri === scheme);
      if (!ssaiEvent) {
        if (
          scheme &&
          (scheme.includes("scte35") ||
            scheme.includes("ad-id") ||
            scheme.includes("urn:scte"))
        ) {
          warnings.push({
            severity: "HIGH",
            message: `EventStream ${scheme} removed by SSAI`,
            note: "Verify SSAI consumed this for ad insertion",
            periodId: sourcePeriod.id,
          });
        } else {
          errors.push({
            severity: "MEDIUM",
            message: `EventStream ${scheme} missing in SSAI`,
            periodId: sourcePeriod.id,
          });
        }
      } else {
        this.validateEventTiming(srcEvent, ssaiEvent, sourcePeriod.id, errors);
      }
    });
    const newEvents = ssaiEvents.filter(
      (ssaiE) =>
        ssaiE &&
        !sourceEvents.find(
          (srcE) => srcE && srcE.schemeIdUri === ssaiE.schemeIdUri
        )
    );
    if (newEvents.length > 0) {
      warnings.push({
        severity: "INFO",
        message: `SSAI added ${newEvents.length} new EventStreams`,
        schemes: newEvents.map((e) => e.schemeIdUri),
      });
    }
    const srcInband = Array.isArray(sourcePeriod.InbandEventStream)
      ? sourcePeriod.InbandEventStream
      : sourcePeriod.InbandEventStream
      ? [sourcePeriod.InbandEventStream]
      : [];
    const ssaiInband = Array.isArray(ssaiPeriod.InbandEventStream)
      ? ssaiPeriod.InbandEventStream
      : ssaiPeriod.InbandEventStream
      ? [ssaiPeriod.InbandEventStream]
      : [];
    srcInband.forEach((srcIE) => {
      if (!srcIE) return;
      const ssaiIE = ssaiInband.find(
        (e) => e && e.schemeIdUri === srcIE.schemeIdUri
      );
      if (!ssaiIE) {
        warnings.push({
          severity: "HIGH",
          message: `InbandEventStream ${srcIE.schemeIdUri} removed by SSAI`,
          periodId: sourcePeriod.id,
        });
      }
    });
    return { errors, warnings };
  },
  validateEventTiming(srcEvent, ssaiEvent, periodId, errors) {
    const srcEventElements = Array.isArray(srcEvent.Event)
      ? srcEvent.Event
      : srcEvent.Event
      ? [srcEvent.Event]
      : [];
    const ssaiEventElements = Array.isArray(ssaiEvent.Event)
      ? ssaiEvent.Event
      : ssaiEvent.Event
      ? [ssaiEvent.Event]
      : [];
    srcEventElements.forEach((srcE) => {
      if (!srcE) return;
      const matchingEvent = ssaiEventElements.find((ssaiE) => {
        if (!ssaiE) return false;
        return (
          (srcE.id && ssaiE.id && srcE.id === ssaiE.id) ||
          Math.abs(
            (srcE.presentationTime || 0) - (ssaiE.presentationTime || 0)
          ) < 1000
        );
      });
      if (!matchingEvent) {
        errors.push({
          severity: "HIGH",
          message: `Event ${srcE.id || "unknown"} missing or timing shifted`,
          scheme: srcEvent.schemeIdUri,
          periodId,
          expectedTime: srcE.presentationTime,
        });
      }
    });
  },
  validateAdaptationSets(sourceAS, ssaiAS, periodId) {
    const errors = [];
    const warnings = [];
    const sourceArray = Array.isArray(sourceAS)
      ? sourceAS
      : sourceAS
      ? [sourceAS]
      : [];
    const ssaiArray = Array.isArray(ssaiAS) ? ssaiAS : ssaiAS ? [ssaiAS] : [];

    // Enhanced AdaptationSet validation
    const asStructureValidation = this.validateAdaptationSetStructure(
      sourceArray,
      ssaiArray,
      periodId
    );
    errors.push(...asStructureValidation.errors);
    warnings.push(...asStructureValidation.warnings);

    const sourceMap = this.buildSemanticMap(sourceArray);
    const ssaiMap = this.buildSemanticMap(ssaiArray);
    Object.keys(sourceMap).forEach((semanticKey) => {
      const srcSet = sourceMap[semanticKey];
      let ssaiSet = ssaiMap[semanticKey];
      if (!ssaiSet) {
        const keyParts = semanticKey.split(":");
        if (keyParts.length >= 3) {
          const fuzzyKey = `${keyParts[0]}:${keyParts[1]}:${keyParts[2]}:`;
          const fuzzyMatch = Object.keys(ssaiMap).find((k) =>
            k.startsWith(fuzzyKey)
          );
          if (fuzzyMatch) {
            ssaiSet = ssaiMap[fuzzyMatch];
            warnings.push({
              severity: "LOW",
              message: `AdaptationSet matched with different codec`,
              periodId,
              semanticKey,
              matchedKey: fuzzyMatch,
            });
          }
        }
      }
      if (!ssaiSet) {
        errors.push({
          severity: "VERY_HIGH",
          message: `Missing AdaptationSet in SSAI`,
          periodId,
          semanticKey,
          details: `${
            srcSet.contentType || "unknown"
          } track with role=${this.getRoleString(srcSet.Role)}, lang=${
            srcSet.lang || "und"
          }`,
        });
        return;
      }
      this.validateAdaptationSetAttributes(srcSet, ssaiSet, periodId, errors);
      this.validateRoles(srcSet.Role, ssaiSet.Role, periodId, errors);
      this.validateAccessibility(
        srcSet.Accessibility,
        ssaiSet.Accessibility,
        periodId,
        errors
      );
      if (srcSet.Label && srcSet.Label !== ssaiSet.Label) {
        warnings.push({
          severity: "LOW",
          message: "Label mismatch",
          periodId,
          expected: srcSet.Label,
          actual: ssaiSet.Label,
        });
      }
      if (
        srcSet.contentType === "audio" ||
        srcSet.mimeType?.includes("audio")
      ) {
        this.validateAudioChannels(srcSet, ssaiSet, periodId, errors);
      }
      this.validateEssentialProperties(srcSet, ssaiSet, periodId, errors);
      this.validateSupplementalProperties(srcSet, ssaiSet, periodId, warnings);
    });
    return { errors, warnings };
  },

  validateAdaptationSetStructure(sourceArray, ssaiArray, periodId) {
    const errors = [];
    const warnings = [];

    // AdaptationSet count validation
    if (sourceArray.length > ssaiArray.length) {
      errors.push({
        severity: "VERY_HIGH",
        message: `Missing AdaptationSets in SSAI period`,
        periodId,
        expected: sourceArray.length,
        actual: ssaiArray.length,
        impact: "Media tracks missing, playback may fail",
      });
    }

    // Validate each source AdaptationSet
    sourceArray.forEach((srcAS, index) => {
      if (!srcAS) return;

      // AdaptationSet ID validation
      if (srcAS.id) {
        const ssaiASWithId = ssaiArray.find((as) => as && as.id === srcAS.id);
        if (!ssaiASWithId) {
          warnings.push({
            severity: "MEDIUM",
            message: `AdaptationSet ID missing in SSAI: ${srcAS.id}`,
            periodId,
            adaptationSetId: srcAS.id,
          });
        }
      }

      // ContentType validation
      if (!srcAS.contentType && !srcAS.mimeType) {
        errors.push({
          severity: "HIGH",
          message: `AdaptationSet missing contentType and mimeType`,
          periodId,
          adaptationSetId: srcAS.id || `index_${index}`,
          impact: "Content type cannot be determined",
        });
      }

      // MimeType validation
      if (srcAS.mimeType) {
        const validMimeTypes = [
          "video/mp4",
          "audio/mp4",
          "application/mp4",
          "video/webm",
          "audio/webm",
          "application/ttml+xml",
          "text/vtt",
        ];
        if (
          !validMimeTypes.some((valid) =>
            srcAS.mimeType.startsWith(valid.split("/")[0])
          )
        ) {
          warnings.push({
            severity: "MEDIUM",
            message: `Unusual mimeType: ${srcAS.mimeType}`,
            periodId,
            adaptationSetId: srcAS.id || `index_${index}`,
          });
        }
      }

      // Codecs validation
      if (!srcAS.codecs) {
        warnings.push({
          severity: "MEDIUM",
          message: `AdaptationSet missing codecs attribute`,
          periodId,
          adaptationSetId: srcAS.id || `index_${index}`,
          note: "Codecs help players determine compatibility",
        });
      } else {
        const codecValidation = this.validateCodecs(
          srcAS.codecs,
          srcAS.contentType || srcAS.mimeType
        );
        if (!codecValidation.valid) {
          warnings.push({
            severity: "MEDIUM",
            message: `Potentially invalid codec: ${srcAS.codecs}`,
            periodId,
            adaptationSetId: srcAS.id || `index_${index}`,
            details: codecValidation.reason,
          });
        }
      }

      // Language validation
      if (srcAS.lang && !this.isValidLanguageCode(srcAS.lang)) {
        warnings.push({
          severity: "LOW",
          message: `Invalid language code: ${srcAS.lang}`,
          periodId,
          adaptationSetId: srcAS.id || `index_${index}`,
          note: "Should follow RFC 5646 format",
        });
      }

      // SegmentAlignment validation
      if (srcAS.segmentAlignment === undefined) {
        warnings.push({
          severity: "LOW",
          message: `AdaptationSet missing segmentAlignment attribute`,
          periodId,
          adaptationSetId: srcAS.id || `index_${index}`,
          note: "Explicit segmentAlignment improves switching",
        });
      }
    });

    return { errors, warnings };
  },

  validateCodecs(codecs, contentTypeOrMime) {
    if (!codecs) return { valid: false, reason: "No codecs specified" };

    const codecStr = codecs.toLowerCase();
    const contentType = contentTypeOrMime
      ? contentTypeOrMime.toLowerCase()
      : "";

    // Video codecs
    if (contentType.includes("video")) {
      const validVideoCodecs = [
        "avc1",
        "avc3",
        "hev1",
        "hvc1",
        "vp8",
        "vp9",
        "av01",
      ];
      if (!validVideoCodecs.some((valid) => codecStr.startsWith(valid))) {
        return { valid: false, reason: `Unknown video codec: ${codecs}` };
      }
    }

    // Audio codecs
    if (contentType.includes("audio")) {
      const validAudioCodecs = [
        "mp4a",
        "opus",
        "vorbis",
        "flac",
        "ac-3",
        "ec-3",
      ];
      if (!validAudioCodecs.some((valid) => codecStr.startsWith(valid))) {
        return { valid: false, reason: `Unknown audio codec: ${codecs}` };
      }
    }

    return { valid: true };
  },

  isValidLanguageCode(lang) {
    if (!lang) return false;
    // Basic RFC 5646 validation (simplified)
    const langRegex = /^[a-z]{2,3}(-[A-Z]{2})?(-[a-z0-9]+)*$/;
    return langRegex.test(lang) || lang === "und";
  },
  validateAdaptationSetAttributes(srcSet, ssaiSet, periodId, errors) {
    const criticalAttrs = ["mimeType", "codecs", "contentType", "lang"];
    criticalAttrs.forEach((attr) => {
      if (srcSet[attr] && srcSet[attr] !== ssaiSet[attr]) {
        errors.push({
          severity: "VERY_HIGH",
          message: `${attr} mismatch in AdaptationSet`,
          periodId,
          expected: srcSet[attr],
          actual: ssaiSet[attr],
        });
      }
    });
    if (
      srcSet.segmentAlignment !== undefined &&
      srcSet.segmentAlignment !== ssaiSet.segmentAlignment
    ) {
      errors.push({
        severity: "HIGH",
        message: "segmentAlignment mismatch",
        periodId,
        expected: srcSet.segmentAlignment,
        actual: ssaiSet.segmentAlignment,
      });
    }
  },
  validateRoles(sourceRoles, ssaiRoles, periodId, errors) {
    const srcRoleValues = this.getRoleArray(sourceRoles);
    const ssaiRoleValues = this.getRoleArray(ssaiRoles);
    if (JSON.stringify(srcRoleValues) !== JSON.stringify(ssaiRoleValues)) {
      errors.push({
        severity: "HIGH",
        message: "Role mismatch",
        periodId,
        expected: srcRoleValues,
        actual: ssaiRoleValues,
      });
    }
  },
  getRoleArray(roles) {
    if (!roles) return ["main"];
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    return rolesArray
      .filter((r) => r && r.value)
      .map((r) => r.value)
      .sort();
  },
  validateAccessibility(sourceAcc, ssaiAcc, periodId, errors) {
    const srcArray = Array.isArray(sourceAcc)
      ? sourceAcc
      : sourceAcc
      ? [sourceAcc]
      : [];
    const ssaiArray = Array.isArray(ssaiAcc)
      ? ssaiAcc
      : ssaiAcc
      ? [ssaiAcc]
      : [];
    const srcSchemes = srcArray
      .filter((a) => a)
      .map((a) => a.schemeIdUri)
      .sort();
    const ssaiSchemes = ssaiArray
      .filter((a) => a)
      .map((a) => a.schemeIdUri)
      .sort();
    srcSchemes.forEach((scheme) => {
      if (scheme && !ssaiSchemes.includes(scheme)) {
        errors.push({
          severity: "HIGH",
          message: `Accessibility feature removed: ${scheme}`,
          periodId,
          impact: "May violate accessibility requirements",
        });
      }
    });
  },
  validateAudioChannels(srcSet, ssaiSet, periodId, errors) {
    const srcChannels = srcSet.AudioChannelConfiguration;
    const ssaiChannels = ssaiSet.AudioChannelConfiguration;

    // Enhanced audio channel validation
    const audioValidation = this.validateAudioChannelConfiguration(
      srcChannels,
      ssaiChannels,
      periodId
    );
    errors.push(...audioValidation.errors);

    // Legacy validation for backward compatibility
    const srcChannelValue = srcChannels?.value;
    const ssaiChannelValue = ssaiChannels?.value;
    if (srcChannelValue && srcChannelValue !== ssaiChannelValue) {
      errors.push({
        severity: "HIGH",
        message: "Audio channel configuration mismatch",
        periodId,
        expected: srcChannelValue,
        actual: ssaiChannelValue,
      });
    }
  },

  validateAudioChannelConfiguration(srcChannels, ssaiChannels, periodId) {
    const errors = [];
    const warnings = [];

    if (!srcChannels && !ssaiChannels) {
      return { errors, warnings };
    }

    if (srcChannels && !ssaiChannels) {
      errors.push({
        severity: "HIGH",
        message: "AudioChannelConfiguration removed in SSAI",
        periodId,
        impact: "Audio channel information lost",
        expected: `${srcChannels.schemeIdUri}: ${srcChannels.value}`,
      });
      return { errors, warnings };
    }

    if (!srcChannels && ssaiChannels) {
      warnings.push({
        severity: "INFO",
        message: "AudioChannelConfiguration added in SSAI",
        periodId,
        added: `${ssaiChannels.schemeIdUri}: ${ssaiChannels.value}`,
      });
      return { errors, warnings };
    }

    // Validate schemeIdUri
    if (srcChannels.schemeIdUri !== ssaiChannels.schemeIdUri) {
      errors.push({
        severity: "HIGH",
        message: "AudioChannelConfiguration schemeIdUri mismatch",
        periodId,
        expected: srcChannels.schemeIdUri,
        actual: ssaiChannels.schemeIdUri,
        impact: "Different audio channel interpretation",
      });
    }

    // Validate value based on scheme
    if (srcChannels.value !== ssaiChannels.value) {
      const channelValidation = this.validateChannelValue(
        srcChannels.schemeIdUri,
        srcChannels.value,
        ssaiChannels.value
      );

      if (!channelValidation.compatible) {
        errors.push({
          severity: "HIGH",
          message: "Incompatible audio channel configuration",
          periodId,
          scheme: srcChannels.schemeIdUri,
          expected: srcChannels.value,
          actual: ssaiChannels.value,
          details: channelValidation.reason,
        });
      } else if (channelValidation.warning) {
        warnings.push({
          severity: "MEDIUM",
          message: "Audio channel configuration changed",
          periodId,
          scheme: srcChannels.schemeIdUri,
          expected: srcChannels.value,
          actual: ssaiChannels.value,
          note: channelValidation.reason,
        });
      }
    }

    return { errors, warnings };
  },

  validateChannelValue(schemeIdUri, srcValue, ssaiValue) {
    if (!schemeIdUri) {
      return { compatible: false, reason: "No schemeIdUri specified" };
    }

    // MPEG-DASH Audio Channel Configuration
    if (
      schemeIdUri === "urn:mpeg:dash:23003:3:audio_channel_configuration:2011"
    ) {
      return this.validateMPEGChannelConfig(srcValue, ssaiValue);
    }

    // Dolby Audio Channel Configuration
    if (schemeIdUri.includes("dolby")) {
      return this.validateDolbyChannelConfig(srcValue, ssaiValue);
    }

    // DTS Audio Channel Configuration
    if (schemeIdUri.includes("dts")) {
      return this.validateDTSChannelConfig(srcValue, ssaiValue);
    }

    // Generic validation
    if (srcValue === ssaiValue) {
      return { compatible: true };
    }

    // Try to parse as numeric channel count
    const srcNum = parseInt(srcValue);
    const ssaiNum = parseInt(ssaiValue);
    if (!isNaN(srcNum) && !isNaN(ssaiNum)) {
      if (srcNum === ssaiNum) {
        return { compatible: true };
      } else {
        return {
          compatible: false,
          reason: `Channel count mismatch: ${srcNum} vs ${ssaiNum}`,
        };
      }
    }

    return {
      compatible: false,
      reason: `Unknown channel configuration format for scheme ${schemeIdUri}`,
    };
  },

  validateMPEGChannelConfig(srcValue, ssaiValue) {
    // MPEG-DASH channel configuration values
    const mpegChannelConfigs = {
      1: "Mono",
      2: "Stereo",
      3: "3.0",
      4: "4.0",
      5: "5.0",
      6: "5.1",
      7: "6.1",
      8: "7.1",
    };

    const srcConfig = mpegChannelConfigs[srcValue];
    const ssaiConfig = mpegChannelConfigs[ssaiValue];

    if (srcValue === ssaiValue) {
      return { compatible: true };
    }

    if (srcConfig && ssaiConfig) {
      // Check if it's a downmix (acceptable) or upmix (potentially problematic)
      const srcChannels = parseInt(srcValue);
      const ssaiChannels = parseInt(ssaiValue);

      if (ssaiChannels < srcChannels) {
        return {
          compatible: true,
          warning: true,
          reason: `Downmix from ${srcConfig} to ${ssaiConfig}`,
        };
      } else {
        return {
          compatible: false,
          reason: `Upmix from ${srcConfig} to ${ssaiConfig} not recommended`,
        };
      }
    }

    return {
      compatible: false,
      reason: `Invalid MPEG channel configuration: ${srcValue} vs ${ssaiValue}`,
    };
  },

  validateDolbyChannelConfig(srcValue, ssaiValue) {
    if (srcValue === ssaiValue) {
      return { compatible: true };
    }

    // Dolby configurations are typically complex and should match exactly
    return {
      compatible: false,
      reason: "Dolby audio configurations must match exactly",
    };
  },

  validateDTSChannelConfig(srcValue, ssaiValue) {
    if (srcValue === ssaiValue) {
      return { compatible: true };
    }

    // DTS configurations are typically complex and should match exactly
    return {
      compatible: false,
      reason: "DTS audio configurations must match exactly",
    };
  },
  validateEssentialProperties(srcSet, ssaiSet, periodId, errors) {
    const srcArray = Array.isArray(srcSet.EssentialProperty)
      ? srcSet.EssentialProperty
      : srcSet.EssentialProperty
      ? [srcSet.EssentialProperty]
      : [];
    const ssaiArray = Array.isArray(ssaiSet.EssentialProperty)
      ? ssaiSet.EssentialProperty
      : ssaiSet.EssentialProperty
      ? [ssaiSet.EssentialProperty]
      : [];
    srcArray.forEach((prop) => {
      if (!prop) return;
      const ssaiProp = ssaiArray.find(
        (p) => p && p.schemeIdUri === prop.schemeIdUri
      );
      if (!ssaiProp) {
        errors.push({
          severity: "VERY_HIGH",
          message: `EssentialProperty removed: ${prop.schemeIdUri}`,
          periodId,
          impact:
            "Player MUST understand this property - removal breaks playback",
        });
      } else if (prop.value && prop.value !== ssaiProp.value) {
        errors.push({
          severity: "VERY_HIGH",
          message: `EssentialProperty value mismatch`,
          periodId,
          scheme: prop.schemeIdUri,
          expected: prop.value,
          actual: ssaiProp.value,
        });
      }
    });
  },
  validateSupplementalProperties(srcSet, ssaiSet, periodId, warnings) {
    const srcArray = Array.isArray(srcSet.SupplementalProperty)
      ? srcSet.SupplementalProperty
      : srcSet.SupplementalProperty
      ? [srcSet.SupplementalProperty]
      : [];
    const ssaiArray = Array.isArray(ssaiSet.SupplementalProperty)
      ? ssaiSet.SupplementalProperty
      : ssaiSet.SupplementalProperty
      ? [ssaiSet.SupplementalProperty]
      : [];
    srcArray.forEach((prop) => {
      if (!prop) return;
      const ssaiProp = ssaiArray.find(
        (p) => p && p.schemeIdUri === prop.schemeIdUri
      );
      if (!ssaiProp) {
        warnings.push({
          severity: "LOW",
          message: `SupplementalProperty removed: ${prop.schemeIdUri}`,
          periodId,
          note: "Optional metadata, not critical",
        });
      }
    });
  },
  matchRepresentations(sourceReps, ssaiReps) {
    const matches = [];
    const sourceArray = Array.isArray(sourceReps)
      ? sourceReps
      : sourceReps
      ? [sourceReps]
      : [];
    const ssaiArray = Array.isArray(ssaiReps)
      ? ssaiReps
      : ssaiReps
      ? [ssaiReps]
      : [];
    const usedSSAI = new Set();
    sourceArray.forEach((srcRep) => {
      if (!srcRep || !srcRep.bandwidth) return;
      let bestMatch = null;
      let bestScore = -1;
      ssaiArray.forEach((ssaiRep, idx) => {
        if (!ssaiRep || usedSSAI.has(idx)) return;
        let score = 0;
        const bandwidthDiff = Math.abs(
          (ssaiRep.bandwidth || 0) - srcRep.bandwidth
        );
        const bandwidthTolerance = srcRep.bandwidth * 0.01;
        if (bandwidthDiff <= bandwidthTolerance) {
          score += 100;
        } else if (bandwidthDiff <= srcRep.bandwidth * 0.05) {
          score += 50;
        }
        if (srcRep.width && srcRep.height) {
          if (
            ssaiRep.width === srcRep.width &&
            ssaiRep.height === srcRep.height
          ) {
            score += 50;
          }
        }
        if (srcRep.codecs && ssaiRep.codecs === srcRep.codecs) {
          score += 25;
        }
        if (srcRep.frameRate && ssaiRep.frameRate === srcRep.frameRate) {
          score += 10;
        }
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { rep: ssaiRep, index: idx };
        }
      });
      if (bestMatch && bestScore >= 100) {
        usedSSAI.add(bestMatch.index);
        matches.push({
          srcRep,
          ssaiRep: bestMatch.rep,
        });
      } else {
        matches.push({
          srcRep,
          ssaiRep: null,
        });
      }
    });
    return matches;
  },
  validateRepresentations(sourceReps, ssaiReps, adaptationSetId, periodId) {
    const errors = [];
    const warnings = [];

    // Enhanced Representation validation
    const repStructureValidation = this.validateRepresentationStructure(
      sourceReps,
      ssaiReps,
      adaptationSetId,
      periodId
    );
    errors.push(...repStructureValidation.errors);
    warnings.push(...repStructureValidation.warnings);

    const repMatches = this.matchRepresentations(sourceReps, ssaiReps);
    repMatches.forEach(({ srcRep, ssaiRep }) => {
      if (!ssaiRep) {
        errors.push({
          severity: "HIGH",
          message: `Missing representation: ${srcRep.bandwidth}bps`,
          periodId,
          adaptationSetId,
          representation: {
            bandwidth: srcRep.bandwidth,
            width: srcRep.width,
            height: srcRep.height,
          },
        });
        return;
      }

      // Enhanced representation attribute validation
      const attrValidation = this.validateRepresentationAttributes(
        srcRep,
        ssaiRep,
        adaptationSetId,
        periodId
      );
      errors.push(...attrValidation.errors);
      warnings.push(...attrValidation.warnings);

      const exactMatchAttrs = [
        "bandwidth",
        "width",
        "height",
        "codecs",
        "frameRate",
        "audioSamplingRate",
        "sar",
      ];
      exactMatchAttrs.forEach((attr) => {
        if (srcRep[attr] === undefined || srcRep[attr] === null) return;
        if (srcRep[attr] !== ssaiRep[attr]) {
          if (
            typeof srcRep[attr] === "number" &&
            typeof ssaiRep[attr] === "number"
          ) {
            const tolerance = srcRep[attr] * 0.01;
            if (Math.abs(srcRep[attr] - ssaiRep[attr]) <= tolerance) {
              return;
            }
          }
          errors.push({
            severity: "VERY_HIGH",
            message: `Representation ${attr} mismatch`,
            periodId,
            adaptationSetId,
            expected: srcRep[attr],
            actual: ssaiRep[attr],
          });
        }
      });
    });

    // ABR ladder validation
    const abrValidation = this.validateABRLadder(
      sourceReps,
      ssaiReps,
      adaptationSetId,
      periodId
    );
    errors.push(...abrValidation.errors);
    warnings.push(...abrValidation.warnings);

    return { errors, warnings, matches: repMatches };
  },

  validateRepresentationStructure(
    sourceReps,
    ssaiReps,
    adaptationSetId,
    periodId
  ) {
    const errors = [];
    const warnings = [];

    const sourceArray = Array.isArray(sourceReps)
      ? sourceReps
      : sourceReps
      ? [sourceReps]
      : [];
    const ssaiArray = Array.isArray(ssaiReps)
      ? ssaiReps
      : ssaiReps
      ? [ssaiReps]
      : [];

    // Representation count validation
    if (sourceArray.length > ssaiArray.length) {
      errors.push({
        severity: "HIGH",
        message: `Missing representations in SSAI AdaptationSet`,
        periodId,
        adaptationSetId,
        expected: sourceArray.length,
        actual: ssaiArray.length,
        impact: "Reduced quality options for adaptive streaming",
      });
    }

    // Validate each source representation
    sourceArray.forEach((srcRep, index) => {
      if (!srcRep) return;

      // Representation ID validation
      if (srcRep.id) {
        const ssaiRepWithId = ssaiArray.find(
          (rep) => rep && rep.id === srcRep.id
        );
        if (!ssaiRepWithId) {
          warnings.push({
            severity: "MEDIUM",
            message: `Representation ID missing in SSAI: ${srcRep.id}`,
            periodId,
            adaptationSetId,
            representationId: srcRep.id,
          });
        }
      }

      // Bandwidth validation (required)
      if (!srcRep.bandwidth) {
        errors.push({
          severity: "VERY_HIGH",
          message: `Representation missing bandwidth`,
          periodId,
          adaptationSetId,
          representationId: srcRep.id || `index_${index}`,
          impact: "Cannot determine bitrate for adaptive streaming",
        });
      } else if (srcRep.bandwidth <= 0) {
        errors.push({
          severity: "HIGH",
          message: `Invalid bandwidth value: ${srcRep.bandwidth}`,
          periodId,
          adaptationSetId,
          representationId: srcRep.id || `index_${index}`,
        });
      }
    });

    return { errors, warnings };
  },

  validateRepresentationAttributes(srcRep, ssaiRep, adaptationSetId, periodId) {
    const errors = [];
    const warnings = [];

    // Video-specific validation
    if (srcRep.width || srcRep.height) {
      if (!ssaiRep.width || !ssaiRep.height) {
        errors.push({
          severity: "HIGH",
          message: `Video representation missing resolution`,
          periodId,
          adaptationSetId,
          representationId: srcRep.id || ssaiRep.id,
          expected: `${srcRep.width}x${srcRep.height}`,
          actual: `${ssaiRep.width || "missing"}x${
            ssaiRep.height || "missing"
          }`,
        });
      } else {
        // Validate aspect ratio consistency
        const srcAspectRatio = srcRep.width / srcRep.height;
        const ssaiAspectRatio = ssaiRep.width / ssaiRep.height;
        const aspectDiff = Math.abs(srcAspectRatio - ssaiAspectRatio);
        if (aspectDiff > 0.01) {
          // 1% tolerance
          warnings.push({
            severity: "MEDIUM",
            message: `Aspect ratio mismatch`,
            periodId,
            adaptationSetId,
            representationId: srcRep.id || ssaiRep.id,
            expected: srcAspectRatio.toFixed(3),
            actual: ssaiAspectRatio.toFixed(3),
          });
        }
      }

      // Frame rate validation
      if (srcRep.frameRate && ssaiRep.frameRate) {
        const srcFR = this.parseFrameRate(srcRep.frameRate);
        const ssaiFR = this.parseFrameRate(ssaiRep.frameRate);
        if (srcFR && ssaiFR && Math.abs(srcFR - ssaiFR) > 0.1) {
          errors.push({
            severity: "HIGH",
            message: `Frame rate mismatch`,
            periodId,
            adaptationSetId,
            representationId: srcRep.id || ssaiRep.id,
            expected: srcRep.frameRate,
            actual: ssaiRep.frameRate,
          });
        }
      }
    }

    // Audio-specific validation
    if (srcRep.audioSamplingRate || ssaiRep.audioSamplingRate) {
      if (srcRep.audioSamplingRate && !ssaiRep.audioSamplingRate) {
        errors.push({
          severity: "HIGH",
          message: `Audio sampling rate missing in SSAI`,
          periodId,
          adaptationSetId,
          representationId: srcRep.id || ssaiRep.id,
          expected: srcRep.audioSamplingRate,
        });
      } else if (srcRep.audioSamplingRate && ssaiRep.audioSamplingRate) {
        const sampleRateDiff = Math.abs(
          srcRep.audioSamplingRate - ssaiRep.audioSamplingRate
        );
        if (sampleRateDiff > 0) {
          errors.push({
            severity: "HIGH",
            message: `Audio sampling rate mismatch`,
            periodId,
            adaptationSetId,
            representationId: srcRep.id || ssaiRep.id,
            expected: srcRep.audioSamplingRate,
            actual: ssaiRep.audioSamplingRate,
          });
        }
      }
    }

    // Codecs validation
    if (srcRep.codecs && ssaiRep.codecs) {
      if (srcRep.codecs !== ssaiRep.codecs) {
        // Check if it's just a profile/level difference
        const srcBaseCodec = srcRep.codecs.split(".")[0];
        const ssaiBaseCodec = ssaiRep.codecs.split(".")[0];
        if (srcBaseCodec !== ssaiBaseCodec) {
          errors.push({
            severity: "VERY_HIGH",
            message: `Codec family mismatch`,
            periodId,
            adaptationSetId,
            representationId: srcRep.id || ssaiRep.id,
            expected: srcRep.codecs,
            actual: ssaiRep.codecs,
          });
        } else {
          warnings.push({
            severity: "MEDIUM",
            message: `Codec profile/level mismatch`,
            periodId,
            adaptationSetId,
            representationId: srcRep.id || ssaiRep.id,
            expected: srcRep.codecs,
            actual: ssaiRep.codecs,
            note: "Same codec family but different profile/level",
          });
        }
      }
    }

    return { errors, warnings };
  },

  validateABRLadder(sourceReps, ssaiReps, adaptationSetId, periodId) {
    const errors = [];
    const warnings = [];

    const sourceArray = Array.isArray(sourceReps)
      ? sourceReps
      : sourceReps
      ? [sourceReps]
      : [];
    const ssaiArray = Array.isArray(ssaiReps)
      ? ssaiReps
      : ssaiReps
      ? [ssaiReps]
      : [];

    // Extract and sort bandwidths
    const sourceBandwidths = sourceArray
      .filter((rep) => rep && rep.bandwidth)
      .map((rep) => rep.bandwidth)
      .sort((a, b) => a - b);

    const ssaiBandwidths = ssaiArray
      .filter((rep) => rep && rep.bandwidth)
      .map((rep) => rep.bandwidth)
      .sort((a, b) => a - b);

    if (sourceBandwidths.length === 0 || ssaiBandwidths.length === 0) {
      return { errors, warnings };
    }

    // Check bandwidth range coverage
    const sourceMin = sourceBandwidths[0];
    const sourceMax = sourceBandwidths[sourceBandwidths.length - 1];
    const ssaiMin = ssaiBandwidths[0];
    const ssaiMax = ssaiBandwidths[ssaiBandwidths.length - 1];

    if (ssaiMin > sourceMin * 1.1) {
      // 10% tolerance
      warnings.push({
        severity: "MEDIUM",
        message: `SSAI missing low-bandwidth representations`,
        periodId,
        adaptationSetId,
        sourceMinBandwidth: sourceMin,
        ssaiMinBandwidth: ssaiMin,
        impact: "Users with poor connections may not be able to play",
      });
    }

    if (ssaiMax < sourceMax * 0.9) {
      // 10% tolerance
      warnings.push({
        severity: "MEDIUM",
        message: `SSAI missing high-bandwidth representations`,
        periodId,
        adaptationSetId,
        sourceMaxBandwidth: sourceMax,
        ssaiMaxBandwidth: ssaiMax,
        impact: "High-quality playback options reduced",
      });
    }

    // Check for reasonable bandwidth distribution
    if (sourceBandwidths.length > 2 && ssaiBandwidths.length > 2) {
      const sourceBandwidthRatios =
        this.calculateBandwidthRatios(sourceBandwidths);
      const ssaiBandwidthRatios = this.calculateBandwidthRatios(ssaiBandwidths);

      // Check if SSAI has reasonable step sizes
      const avgSourceRatio =
        sourceBandwidthRatios.reduce((sum, ratio) => sum + ratio, 0) /
        sourceBandwidthRatios.length;
      const avgSSAIRatio =
        ssaiBandwidthRatios.reduce((sum, ratio) => sum + ratio, 0) /
        ssaiBandwidthRatios.length;

      if (avgSSAIRatio > avgSourceRatio * 2) {
        warnings.push({
          severity: "LOW",
          message: `SSAI ABR ladder has large bandwidth gaps`,
          periodId,
          adaptationSetId,
          note: "Consider adding intermediate quality levels for smoother adaptation",
        });
      }
    }

    return { errors, warnings };
  },

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
  },

  calculateBandwidthRatios(bandwidths) {
    const ratios = [];
    for (let i = 1; i < bandwidths.length; i++) {
      ratios.push(bandwidths[i] / bandwidths[i - 1]);
    }
    return ratios;
  },
  validateSegmentTemplate(sourceTemplate, ssaiTemplate, repId, periodId) {
    const errors = [];
    const warnings = [];
    if (!sourceTemplate || !ssaiTemplate) {
      return { errors, warnings };
    }

    // Enhanced SegmentTemplate validation
    const templateStructureValidation = this.validateSegmentTemplateStructure(
      sourceTemplate,
      ssaiTemplate,
      repId,
      periodId
    );
    errors.push(...templateStructureValidation.errors);
    warnings.push(...templateStructureValidation.warnings);

    const srcTimescale = sourceTemplate.timescale || 1;
    const ssaiTimescale = ssaiTemplate.timescale || 1;
    if (srcTimescale !== ssaiTimescale) {
      errors.push({
        severity: "VERY_HIGH",
        message: "Timescale mismatch",
        periodId,
        representationId: repId,
        expected: srcTimescale,
        actual: ssaiTimescale,
        note: "All timing calculations will be incorrect",
      });
    }
    if (sourceTemplate.duration && ssaiTemplate.duration) {
      const srcDurationNorm = sourceTemplate.duration / srcTimescale;
      const ssaiDurationNorm = ssaiTemplate.duration / ssaiTimescale;
      const durationDiff = Math.abs(srcDurationNorm - ssaiDurationNorm);
      const tolerance = srcDurationNorm * 0.01;
      if (durationDiff > tolerance) {
        errors.push({
          severity: "HIGH",
          message: "Segment duration mismatch",
          periodId,
          representationId: repId,
          expectedSeconds: srcDurationNorm.toFixed(3),
          actualSeconds: ssaiDurationNorm.toFixed(3),
        });
      }
    }
    const srcStartNum = sourceTemplate.startNumber || 1;
    const ssaiStartNum = ssaiTemplate.startNumber || 1;
    if (srcStartNum !== ssaiStartNum) {
      warnings.push({
        severity: "INFO",
        message: "StartNumber shifted by SSAI",
        periodId,
        representationId: repId,
        source: srcStartNum,
        ssai: ssaiStartNum,
        shift: ssaiStartNum - srcStartNum,
      });
    }
    if (sourceTemplate.SegmentTimeline && ssaiTemplate.SegmentTimeline) {
      const timelineResult = this.validateSegmentTimelineMath(
        sourceTemplate.SegmentTimeline,
        ssaiTemplate.SegmentTimeline,
        srcTimescale,
        ssaiTimescale,
        repId,
        periodId
      );

      if (timelineResult.unsupported) {
        warnings.push({
          severity: "MEDIUM",
          message: "SegmentTimeline contains open-ended repeat (r=-1)",
          periodId,
          representationId: repId,
          note: "Exact segment count validation skipped - requires period duration or next S@t",
        });
      } else {
        errors.push(...timelineResult.errors);
      }
    }
    if (!ssaiTemplate.initialization && !ssaiTemplate.media) {
      errors.push({
        severity: "VERY_HIGH",
        message: "Missing segment URL templates",
        periodId,
        representationId: repId,
      });
    }
    return { errors, warnings };
  },

  validateSegmentTemplateStructure(
    sourceTemplate,
    ssaiTemplate,
    repId,
    periodId
  ) {
    const errors = [];
    const warnings = [];

    // Timescale validation
    if (!sourceTemplate.timescale && !ssaiTemplate.timescale) {
      warnings.push({
        severity: "LOW",
        message: "Both templates missing timescale (defaulting to 1)",
        periodId,
        representationId: repId,
        note: "Explicit timescale improves clarity",
      });
    }

    // Duration validation
    if (sourceTemplate.duration && !ssaiTemplate.duration) {
      errors.push({
        severity: "HIGH",
        message: "SSAI template missing duration",
        periodId,
        representationId: repId,
        expected: sourceTemplate.duration,
        impact: "Segment duration cannot be determined",
      });
    }

    // StartNumber validation
    if (sourceTemplate.startNumber && !ssaiTemplate.startNumber) {
      warnings.push({
        severity: "MEDIUM",
        message: "SSAI template missing startNumber",
        periodId,
        representationId: repId,
        expected: sourceTemplate.startNumber,
        note: "Will default to 1",
      });
    }

    // Media template validation
    if (sourceTemplate.media && !ssaiTemplate.media) {
      errors.push({
        severity: "VERY_HIGH",
        message: "SSAI template missing media URL template",
        periodId,
        representationId: repId,
        impact: "Cannot construct segment URLs",
      });
    } else if (sourceTemplate.media && ssaiTemplate.media) {
      const mediaValidation = this.validateURLTemplate(
        sourceTemplate.media,
        ssaiTemplate.media,
        "media"
      );
      if (!mediaValidation.valid) {
        warnings.push({
          severity: "MEDIUM",
          message: `Media URL template structure changed`,
          periodId,
          representationId: repId,
          expected: sourceTemplate.media,
          actual: ssaiTemplate.media,
          details: mediaValidation.reason,
        });
      }
    }

    // Initialization template validation
    if (sourceTemplate.initialization && !ssaiTemplate.initialization) {
      errors.push({
        severity: "HIGH",
        message: "SSAI template missing initialization URL template",
        periodId,
        representationId: repId,
        impact: "Cannot construct initialization segment URLs",
      });
    } else if (sourceTemplate.initialization && ssaiTemplate.initialization) {
      const initValidation = this.validateURLTemplate(
        sourceTemplate.initialization,
        ssaiTemplate.initialization,
        "initialization"
      );
      if (!initValidation.valid) {
        warnings.push({
          severity: "MEDIUM",
          message: `Initialization URL template structure changed`,
          periodId,
          representationId: repId,
          expected: sourceTemplate.initialization,
          actual: ssaiTemplate.initialization,
          details: initValidation.reason,
        });
      }
    }

    // SegmentTimeline validation
    if (sourceTemplate.SegmentTimeline && !ssaiTemplate.SegmentTimeline) {
      errors.push({
        severity: "VERY_HIGH",
        message: "SSAI template missing SegmentTimeline",
        periodId,
        representationId: repId,
        impact: "Segment timing information lost",
      });
    } else if (
      !sourceTemplate.SegmentTimeline &&
      ssaiTemplate.SegmentTimeline
    ) {
      warnings.push({
        severity: "INFO",
        message: "SSAI added SegmentTimeline",
        periodId,
        representationId: repId,
        note: "May provide more precise timing",
      });
    }

    return { errors, warnings };
  },

  validateURLTemplate(sourceTemplate, ssaiTemplate) {
    // Check for required template variables
    const requiredVars = ["$RepresentationID$", "$Number$"];

    let valid = true;
    let reason = "";

    // Check if required variables are preserved
    for (const reqVar of requiredVars) {
      const sourceHas = sourceTemplate.includes(reqVar);
      const ssaiHas = ssaiTemplate.includes(reqVar);

      if (sourceHas && !ssaiHas) {
        valid = false;
        reason += `Missing required variable ${reqVar}. `;
      }
    }

    // Check for $Time$ vs $Number$ consistency
    const sourceUsesTime = sourceTemplate.includes("$Time$");
    const ssaiUsesTime = ssaiTemplate.includes("$Time$");
    const sourceUsesNumber = sourceTemplate.includes("$Number$");
    const ssaiUsesNumber = ssaiTemplate.includes("$Number$");

    if (sourceUsesTime && !ssaiUsesTime && ssaiUsesNumber) {
      reason += "Changed from $Time$ to $Number$ addressing. ";
    } else if (sourceUsesNumber && !ssaiUsesNumber && ssaiUsesTime) {
      reason += "Changed from $Number$ to $Time$ addressing. ";
    }

    return { valid, reason: reason.trim() };
  },
  validateSegmentTimelineMath(
    srcTimeline,
    ssaiTimeline,
    srcScale,
    ssaiScale,
    repId,
    periodId
  ) {
    const errors = [];
    if (!srcTimeline || !ssaiTimeline) {
      return { errors };
    }
    const srcHasOpenRepeat = this.hasOpenEndedRepeat(srcTimeline);
    const ssaiHasOpenRepeat = this.hasOpenEndedRepeat(ssaiTimeline);
    if (srcHasOpenRepeat || ssaiHasOpenRepeat) {
      return {
        unsupported: true,
        errors: [],
      };
    }
    const srcSegments = this.expandSegmentTimeline(srcTimeline, srcScale);
    const ssaiSegments = this.expandSegmentTimeline(ssaiTimeline, ssaiScale);
    if (srcSegments.length === 0 && ssaiSegments.length === 0) {
      return { errors };
    }
    if (srcSegments.length !== ssaiSegments.length) {
      errors.push({
        severity: "HIGH",
        message: "Segment count mismatch in timeline",
        periodId,
        representationId: repId,
        expected: srcSegments.length,
        actual: ssaiSegments.length,
      });
    }
    const minLength = Math.min(srcSegments.length, ssaiSegments.length);
    for (let index = 0; index < minLength; index++) {
      const srcSeg = srcSegments[index];
      const ssaiSeg = ssaiSegments[index];
      const startDiff = Math.abs(srcSeg.startTime - ssaiSeg.startTime);
      const durationDiff = Math.abs(srcSeg.duration - ssaiSeg.duration);
      const tolerance = 0.001;
      if (startDiff > tolerance) {
        errors.push({
          severity: "HIGH",
          message: `Segment ${index} start time mismatch`,
          periodId,
          representationId: repId,
          expectedStart: srcSeg.startTime.toFixed(3),
          actualStart: ssaiSeg.startTime.toFixed(3),
          difference: startDiff.toFixed(3),
        });
      }
      if (durationDiff > tolerance) {
        errors.push({
          severity: "HIGH",
          message: `Segment ${index} duration mismatch`,
          periodId,
          representationId: repId,
          expectedDuration: srcSeg.duration.toFixed(3),
          actualDuration: ssaiSeg.duration.toFixed(3),
          difference: durationDiff.toFixed(3),
        });
      }
    }
    return { errors };
  },
  hasOpenEndedRepeat(timeline) {
    if (!timeline || !timeline.S) return false;
    const sArray = Array.isArray(timeline.S) ? timeline.S : [timeline.S];
    return sArray.some((s) => s && s.r !== undefined && s.r < 0);
  },
  validateContentProtection(sourceCPs, ssaiCPs, periodId) {
    const errors = [];
    const warnings = [];
    const srcArray = Array.isArray(sourceCPs)
      ? sourceCPs
      : sourceCPs
      ? [sourceCPs]
      : [];
    const ssaiArray = Array.isArray(ssaiCPs)
      ? ssaiCPs
      : ssaiCPs
      ? [ssaiCPs]
      : [];
    if (srcArray.length === 0) {
      return { errors, warnings };
    }

    // Enhanced DRM validation
    const drmStructureValidation = this.validateDRMStructure(
      srcArray,
      ssaiArray,
      periodId
    );
    errors.push(...drmStructureValidation.errors);
    warnings.push(...drmStructureValidation.warnings);

    srcArray.forEach((srcCP) => {
      if (!srcCP) return;
      const ssaiCP = ssaiArray.find(
        (cp) => cp && cp.schemeIdUri === srcCP.schemeIdUri
      );
      if (!ssaiCP) {
        errors.push({
          severity: "VERY_HIGH",
          message: `Missing DRM system: ${srcCP.schemeIdUri}`,
          periodId,
        });
        return;
      }

      // Enhanced DRM system validation
      const drmSystemValidation = this.validateDRMSystem(
        srcCP,
        ssaiCP,
        periodId
      );
      errors.push(...drmSystemValidation.errors);
      warnings.push(...drmSystemValidation.warnings);

      if (srcCP.value && srcCP.value !== ssaiCP.value) {
        warnings.push({
          severity: "MEDIUM",
          message: "DRM system value mismatch",
          periodId,
          schemeIdUri: srcCP.schemeIdUri,
          expected: srcCP.value,
          actual: ssaiCP.value,
        });
      }
      if (srcCP.pssh && srcCP.pssh !== ssaiCP.pssh) {
        errors.push({
          severity: "VERY_HIGH",
          message: "PSSH mismatch for DRM system",
          periodId,
          schemeIdUri: srcCP.schemeIdUri,
          note: "DRM initialization data must match exactly",
        });
      }
      if (srcCP.default_KID && srcCP.default_KID !== ssaiCP.default_KID) {
        errors.push({
          severity: "VERY_HIGH",
          message: "default_KID mismatch",
          periodId,
          schemeIdUri: srcCP.schemeIdUri,
          expected: srcCP.default_KID,
          actual: ssaiCP.default_KID,
        });
      }
    });
    return { errors, warnings };
  },

  validateDRMStructure(srcArray, ssaiArray, periodId) {
    const errors = [];
    const warnings = [];

    // Check for missing DRM systems
    if (srcArray.length > ssaiArray.length) {
      errors.push({
        severity: "VERY_HIGH",
        message: `Missing DRM systems in SSAI`,
        periodId,
        expected: srcArray.length,
        actual: ssaiArray.length,
        impact: "Some DRM systems not supported, playback may fail",
      });
    }

    // Validate DRM system coverage
    const sourceDRMSystems = srcArray
      .map((cp) => cp.schemeIdUri)
      .filter(Boolean);
    const ssaiDRMSystems = ssaiArray
      .map((cp) => cp.schemeIdUri)
      .filter(Boolean);

    sourceDRMSystems.forEach((srcSystem) => {
      if (!ssaiDRMSystems.includes(srcSystem)) {
        const systemName = this.getDRMSystemName(srcSystem);
        errors.push({
          severity: "VERY_HIGH",
          message: `Missing DRM system: ${systemName}`,
          periodId,
          schemeIdUri: srcSystem,
          impact: `${systemName} protected content cannot be played`,
        });
      }
    });

    // Check for additional DRM systems in SSAI
    const addedSystems = ssaiDRMSystems.filter(
      (ssaiSystem) => !sourceDRMSystems.includes(ssaiSystem)
    );
    if (addedSystems.length > 0) {
      warnings.push({
        severity: "INFO",
        message: `SSAI added DRM systems`,
        periodId,
        addedSystems: addedSystems.map((sys) => this.getDRMSystemName(sys)),
        note: "Additional DRM support may improve compatibility",
      });
    }

    return { errors, warnings };
  },

  validateDRMSystem(srcCP, ssaiCP, periodId) {
    const errors = [];
    const warnings = [];

    const systemName = this.getDRMSystemName(srcCP.schemeIdUri);

    // Validate schemeIdUri format
    if (!this.isValidDRMSchemeIdUri(srcCP.schemeIdUri)) {
      warnings.push({
        severity: "MEDIUM",
        message: `Non-standard DRM schemeIdUri: ${srcCP.schemeIdUri}`,
        periodId,
        note: "May not be recognized by all players",
      });
    }

    // Validate PSSH data
    if (srcCP.pssh) {
      const psshValidation = this.validatePSSH(srcCP.pssh);
      if (!psshValidation.valid) {
        errors.push({
          severity: "HIGH",
          message: `Invalid PSSH data for ${systemName}`,
          periodId,
          schemeIdUri: srcCP.schemeIdUri,
          details: psshValidation.reason,
        });
      }
    }

    // Validate default_KID format
    if (srcCP.default_KID) {
      const kidValidation = this.validateKeyID(srcCP.default_KID);
      if (!kidValidation.valid) {
        errors.push({
          severity: "HIGH",
          message: `Invalid default_KID format for ${systemName}`,
          periodId,
          schemeIdUri: srcCP.schemeIdUri,
          expected: "32-character hex string or UUID format",
          actual: srcCP.default_KID,
        });
      }
    }

    // System-specific validation
    if (srcCP.schemeIdUri === "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed") {
      // Widevine-specific validation
      const widevineValidation = this.validateWidevineCP(
        srcCP,
        ssaiCP,
        periodId
      );
      errors.push(...widevineValidation.errors);
      warnings.push(...widevineValidation.warnings);
    } else if (
      srcCP.schemeIdUri === "urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95"
    ) {
      // PlayReady-specific validation
      const playreadyValidation = this.validatePlayReadyCP(
        srcCP,
        ssaiCP,
        periodId
      );
      errors.push(...playreadyValidation.errors);
      warnings.push(...playreadyValidation.warnings);
    }

    return { errors, warnings };
  },

  getDRMSystemName(schemeIdUri) {
    const drmSystems = {
      "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed": "Widevine",
      "urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95": "PlayReady",
      "urn:uuid:94ce86fb-07ff-4f43-adb8-93d2fa968ca2": "FairPlay",
      "urn:mpeg:dash:mp4protection:2011": "Common Encryption",
    };
    return drmSystems[schemeIdUri] || schemeIdUri;
  },

  isValidDRMSchemeIdUri(schemeIdUri) {
    if (!schemeIdUri) return false;

    // Standard DRM system UUIDs
    const standardSystems = [
      "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed", // Widevine
      "urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95", // PlayReady
      "urn:uuid:94ce86fb-07ff-4f43-adb8-93d2fa968ca2", // FairPlay
      "urn:mpeg:dash:mp4protection:2011", // Common Encryption
    ];

    if (standardSystems.includes(schemeIdUri)) return true;

    // Check for valid UUID format
    const uuidRegex =
      /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(schemeIdUri);
  },

  validatePSSH(pssh) {
    if (!pssh) return { valid: true }; // PSSH is optional

    try {
      // Basic base64 validation
      const decoded = atob(pssh);
      if (decoded.length < 32) {
        // Minimum PSSH box size
        return { valid: false, reason: "PSSH data too short" };
      }

      // Check PSSH box header
      const header = decoded.substring(4, 8);
      if (header !== "pssh") {
        return { valid: false, reason: "Invalid PSSH box header" };
      }

      return { valid: true };
    } catch (e) {
      return { valid: false, reason: "Invalid base64 encoding" };
    }
  },

  validateKeyID(keyId) {
    if (!keyId) return { valid: false, reason: "Key ID is empty" };

    // Remove hyphens for validation
    const cleanKeyId = keyId.replace(/-/g, "");

    // Check for 32-character hex string
    const hexRegex = /^[0-9a-f]{32}$/i;
    if (hexRegex.test(cleanKeyId)) {
      return { valid: true };
    }

    // Check for UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(keyId)) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: "Must be 32-character hex string or UUID format",
    };
  },

  validateWidevineCP(srcCP, ssaiCP, periodId) {
    const errors = [];
    const warnings = [];

    // Widevine should have PSSH
    if (!srcCP.pssh && !ssaiCP.pssh) {
      warnings.push({
        severity: "MEDIUM",
        message: "Widevine ContentProtection missing PSSH",
        periodId,
        note: "PSSH may be provided in initialization segment instead",
      });
    }

    return { errors, warnings };
  },

  validatePlayReadyCP(srcCP, ssaiCP, periodId) {
    const errors = [];
    const warnings = [];

    // PlayReady often uses pro:mspr element
    if (srcCP.value && srcCP.value !== ssaiCP.value) {
      warnings.push({
        severity: "MEDIUM",
        message: "PlayReady value attribute mismatch",
        periodId,
        note: "May contain different license server URLs",
      });
    }

    return { errors, warnings };
  },
  parseDuration(isoDuration, context = "") {
    if (!isoDuration) return { value: null, error: null };
    if (typeof isoDuration === "number")
      return { value: isoDuration, error: null };
    if (typeof isoDuration !== "string")
      return {
        value: null,
        error: {
          severity: "HIGH",
          message: `Invalid duration type: expected string or number, got ${typeof isoDuration}`,
          context: context,
          value: isoDuration,
        },
      };

    const regex =
      /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/;
    const matches = isoDuration.match(regex);
    if (!matches) {
      return {
        value: null,
        error: {
          severity: "HIGH",
          message: `Invalid ISO 8601 duration format: ${isoDuration}`,
          context: context,
          value: isoDuration,
          expectedFormat: "PT[H]H[M]M[S]S (e.g., PT1H30M45S)",
        },
      };
    }

    const hours = parseFloat(matches[1] || 0);
    const minutes = parseFloat(matches[2] || 0);
    const seconds = parseFloat(matches[3] || 0);
    return { value: hours * 3600 + minutes * 60 + seconds, error: null };
  },
  buildTimeline(periods) {
    const timeline = [];
    let currentTime = 0;
    const periodsArray = Array.isArray(periods)
      ? periods
      : periods
      ? [periods]
      : [];
    periodsArray.forEach((period) => {
      if (!period) return;
      const startResult = period.start
        ? this.parseDuration(
            period.start,
            `period ${period.id || "unknown"} start`
          )
        : { value: currentTime, error: null };
      const durationResult = period.duration
        ? this.parseDuration(
            period.duration,
            `period ${period.id || "unknown"} duration`
          )
        : { value: null, error: null };

      // Note: We don't add errors to the main validation here since buildTimeline
      // is a utility function. The errors will be caught in the main validation flow.

      const actualStart =
        startResult.value !== null ? startResult.value : currentTime;
      timeline.push({
        id: period.id,
        start: actualStart,
        duration: durationResult.value,
        end:
          durationResult.value !== null
            ? actualStart + durationResult.value
            : null,
        period,
      });
      if (durationResult.value !== null) {
        currentTime = actualStart + durationResult.value;
      }
    });
    return timeline;
  },
  validateTimelineContinuity(timeline) {
    const errors = [];
    for (let i = 0; i < timeline.length - 1; i++) {
      const current = timeline[i];
      const next = timeline[i + 1];
      if (!current || !next) continue;
      if (current.end === null) continue;
      const gap = next.start - current.end;
      if (gap > 0.1) {
        errors.push({
          severity: "VERY_HIGH",
          message: `Timeline gap detected: ${gap.toFixed(3)}s`,
          between: `${current.id} and ${next.id}`,
        });
      } else if (gap < -0.1) {
        errors.push({
          severity: "VERY_HIGH",
          message: `Timeline overlap detected: ${Math.abs(gap).toFixed(3)}s`,
          between: `${current.id} and ${next.id}`,
        });
      }
    }
    return errors;
  },
  isAdPeriod(period) {
    const p = period.period || period;
    if (!p) return false;
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
    if (p.AssetIdentifier) {
      const assetIdScheme = p.AssetIdentifier.schemeIdUri;
      if (
        assetIdScheme &&
        (assetIdScheme.includes("ad-id") || assetIdScheme.includes("urn:uuid"))
      ) {
        return true;
      }
    }
    const eventStreams = Array.isArray(p.EventStream)
      ? p.EventStream
      : p.EventStream
      ? [p.EventStream]
      : [];
    const hasAdSignaling = eventStreams.some((es) => {
      if (!es || !es.schemeIdUri) return false;
      const scheme = es.schemeIdUri.toLowerCase();
      return (
        scheme.includes("scte35") ||
        scheme.includes("scte:214") ||
        scheme.includes("urn:scte") ||
        scheme.includes("splice")
      );
    });
    if (hasAdSignaling) return true;
    const essentialProps = Array.isArray(p.EssentialProperty)
      ? p.EssentialProperty
      : p.EssentialProperty
      ? [p.EssentialProperty]
      : [];
    const supplementalProps = Array.isArray(p.SupplementalProperty)
      ? p.SupplementalProperty
      : p.SupplementalProperty
      ? [p.SupplementalProperty]
      : [];
    const allProps = [...essentialProps, ...supplementalProps];
    const hasSSAIProperty = allProps.some((prop) => {
      if (!prop || !prop.schemeIdUri) return false;
      const scheme = prop.schemeIdUri.toLowerCase();
      return (
        scheme.includes("ssai") ||
        scheme.includes("ad-insertion") ||
        scheme.includes("google:dai") ||
        scheme.includes("amazon:mediatailor")
      );
    });
    if (hasSSAIProperty) return true;
    const roles = Array.isArray(p.Role) ? p.Role : p.Role ? [p.Role] : [];
    const hasAdRole = roles.some((role) => {
      if (!role || !role.value) return false;
      const val = role.value.toLowerCase();
      return val.includes("advertisement") || val.includes("ad");
    });
    if (hasAdRole) return true;

    return false;
  },
  buildSemanticMap(adaptationSets) {
    const map = {};
    if (!Array.isArray(adaptationSets)) {
      return map;
    }
    adaptationSets.forEach((as) => {
      if (!as) return;
      const contentType =
        as.contentType || (as.mimeType ? as.mimeType.split("/")[0] : "unknown");
      const lang = as.lang || "und";
      const role = this.getRoleString(as.Role);
      const codecs = (as.codecs || "").split(".")[0] || "unknown";
      const key = `${contentType}:${lang}:${role}:${codecs}`;
      if (map[key]) {
        let index = 1;
        while (map[`${key}_${index}`]) {
          index++;
        }
        map[`${key}_${index}`] = as;
      } else {
        map[key] = as;
      }
    });
    return map;
  },
  getRoleString(roles) {
    if (!roles) return "main";
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    if (rolesArray.length === 0) return "main";
    return (
      rolesArray
        .filter((r) => r && r.value)
        .map((r) => r.value)
        .sort()
        .join(",") || "main"
    );
  },
  expandSegmentTimeline(timeline, timescale) {
    const segments = [];
    if (!timeline || !timeline.S || !timescale) {
      return segments;
    }
    let currentTime = 0;
    const sArray = Array.isArray(timeline.S) ? timeline.S : [timeline.S];
    sArray.forEach((s) => {
      if (!s) return;
      if (s.d === undefined || s.d === null) {
        console.warn("SegmentTimeline S element missing duration (d)");
        return;
      }
      if (s.r !== undefined && s.r < 0) {
        throw new Error(
          `expandSegmentTimeline called with open-ended repeat (r=${s.r}). This should be detected earlier and handled by hasOpenEndedRepeat check.`
        );
      }
      const startTime = s.t !== undefined ? s.t / timescale : currentTime;
      const duration = s.d / timescale;
      const repeat = s.r !== undefined ? parseInt(s.r) : 0;
      const repeatCount = Math.max(0, repeat);
      for (let i = 0; i <= repeatCount; i++) {
        segments.push({
          startTime: startTime + i * duration,
          duration: duration,
        });
      }
      currentTime = startTime + (repeatCount + 1) * duration;
    });
    return segments;
  },
  isValidURL(url) {
    if (!url || typeof url !== "string") return false;
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  },
  executeValidationRules(rules) {
    const errors = [];
    Object.keys(rules).forEach((ruleName) => {
      const rule = rules[ruleName];
      try {
        if (!rule.validate()) {
          errors.push({
            severity: rule.severity,
            message: rule.message,
            rule: ruleName,
          });
        }
      } catch (e) {
        errors.push({
          severity: "HIGH",
          message: `Validation error for ${ruleName}: ${e.message}`,
          rule: ruleName,
        });
      }
    });
    return errors;
  },
  async validate(sourceMPD, ssaiMPD) {
    const results = {
      errors: [],
      warnings: [],
      info: {},
      timestamp: new Date().toISOString(),
    };
    try {
      const rootResult = this.validateMPDRoot(sourceMPD, ssaiMPD);
      results.errors.push(...rootResult.errors);
      results.warnings.push(...rootResult.warnings);

      // Enhanced validation for SSAI/Live critical nodes
      const liveSSAIValidation = this.validateLiveSSAINodes(sourceMPD, ssaiMPD);
      results.errors.push(...liveSSAIValidation.errors);
      results.warnings.push(...liveSSAIValidation.warnings);

      const utcResult = this.validateUTCTiming(sourceMPD, ssaiMPD);
      results.errors.push(...utcResult.errors);
      results.warnings.push(...utcResult.warnings);
      const refreshResult = this.validateManifestRefresh(ssaiMPD);
      results.errors.push(...refreshResult.errors);
      results.warnings.push(...refreshResult.warnings);
      const serviceResult = this.validateServiceDescription(sourceMPD, ssaiMPD);
      results.errors.push(...serviceResult.errors);
      results.warnings.push(...serviceResult.warnings);
      const periodResult = this.validatePeriods(
        sourceMPD.Period,
        ssaiMPD.Period
      );
      results.errors.push(...periodResult.errors);
      results.warnings.push(...periodResult.warnings);
      results.info.adPeriods = periodResult.info?.adPeriods || 0;
      const sourcePeriods = Array.isArray(sourceMPD.Period)
        ? sourceMPD.Period
        : sourceMPD.Period
        ? [sourceMPD.Period]
        : [];
      const ssaiPeriods = Array.isArray(ssaiMPD.Period)
        ? ssaiMPD.Period
        : ssaiMPD.Period
        ? [ssaiMPD.Period]
        : [];
      sourcePeriods.forEach((sourcePeriod) => {
        if (!sourcePeriod) return;
        const ssaiPeriod = this.findMatchingPeriod(sourcePeriod, ssaiPeriods);
        if (!ssaiPeriod) {
          results.errors.push({
            severity: "VERY_HIGH",
            message: `Cannot find matching SSAI period for source period`,
            periodId: sourcePeriod.id,
          });
          return;
        }
        const eventResult = this.validateEventStreams(sourcePeriod, ssaiPeriod);
        results.errors.push(...eventResult.errors);
        results.warnings.push(...eventResult.warnings);
        const sourceAS = sourcePeriod.AdaptationSet;
        const ssaiAS = ssaiPeriod.AdaptationSet;
        const asResult = this.validateAdaptationSets(
          sourceAS,
          ssaiAS,
          sourcePeriod.id
        );
        results.errors.push(...asResult.errors);
        results.warnings.push(...asResult.warnings);
        const sourceASArray = Array.isArray(sourceAS)
          ? sourceAS
          : sourceAS
          ? [sourceAS]
          : [];
        const ssaiASArray = Array.isArray(ssaiAS)
          ? ssaiAS
          : ssaiAS
          ? [ssaiAS]
          : [];
        sourceASArray.forEach((srcAS) => {
          if (!srcAS) return;
          const ssaiASMatched = this.findMatchingAdaptationSet(
            srcAS,
            ssaiASArray
          );
          if (!ssaiASMatched) return;
          const sourceReps = srcAS.Representation;
          const ssaiReps = ssaiASMatched.Representation;
          const repResult = this.validateRepresentations(
            sourceReps,
            ssaiReps,
            srcAS.id,
            sourcePeriod.id
          );
          results.errors.push(...repResult.errors);
          results.warnings.push(...repResult.warnings);
          repResult.matches.forEach(({ srcRep, ssaiRep }) => {
            if (!srcRep || !ssaiRep) return;

            const srcTemplate = srcRep.SegmentTemplate || srcAS.SegmentTemplate;
            const ssaiTemplate =
              ssaiRep.SegmentTemplate || ssaiASMatched.SegmentTemplate;

            if (srcTemplate && ssaiTemplate) {
              const segResult = this.validateSegmentTemplate(
                srcTemplate,
                ssaiTemplate,
                srcRep.id || "unknown",
                sourcePeriod.id
              );
              results.errors.push(...segResult.errors);
              results.warnings.push(...segResult.warnings);
            }
          });

          const srcCP = srcAS.ContentProtection;
          const ssaiCP = ssaiASMatched.ContentProtection;
          const cpResult = this.validateContentProtection(
            srcCP,
            ssaiCP,
            sourcePeriod.id
          );
          results.errors.push(...cpResult.errors);
          results.warnings.push(...cpResult.warnings);
        });
      });
      results.summary = this.generateSummary(results);
      return results;
    } catch (error) {
      results.errors.push({
        severity: "VERY_HIGH",
        message: `Validation failed: ${error.message}`,
        stack: error.stack,
      });
      return results;
    }
  },

  validateLiveSSAINodes(sourceMPD, ssaiMPD) {
    const errors = [];
    const warnings = [];

    // Validate Location elements
    const locationValidation = this.validateLocationElements(
      sourceMPD,
      ssaiMPD
    );
    errors.push(...locationValidation.errors);
    warnings.push(...locationValidation.warnings);

    // Validate PatchLocation elements
    const patchLocationValidation = this.validatePatchLocationElements(
      sourceMPD,
      ssaiMPD
    );
    errors.push(...patchLocationValidation.errors);
    warnings.push(...patchLocationValidation.warnings);

    // Validate EssentialProperty and SupplementalProperty at MPD level
    const propertyValidation = this.validateMPDProperties(sourceMPD, ssaiMPD);
    errors.push(...propertyValidation.errors);
    warnings.push(...propertyValidation.warnings);

    // Validate SSAI-specific requirements
    const ssaiRequirements = this.validateSSAIRequirements(sourceMPD, ssaiMPD);
    errors.push(...ssaiRequirements.errors);
    warnings.push(...ssaiRequirements.warnings);

    return { errors, warnings };
  },

  validateLocationElements(sourceMPD, ssaiMPD) {
    const errors = [];
    const warnings = [];

    const sourceLocations = Array.isArray(sourceMPD.Location)
      ? sourceMPD.Location
      : sourceMPD.Location
      ? [sourceMPD.Location]
      : [];
    const ssaiLocations = Array.isArray(ssaiMPD.Location)
      ? ssaiMPD.Location
      : ssaiMPD.Location
      ? [ssaiMPD.Location]
      : [];

    // For dynamic MPDs, Location elements are important for manifest updates
    if (sourceMPD.type === "dynamic" || ssaiMPD.type === "dynamic") {
      if (sourceLocations.length > 0 && ssaiLocations.length === 0) {
        warnings.push({
          severity: "MEDIUM",
          message: "Location elements removed in SSAI manifest",
          impact: "Manifest update mechanism may be affected",
          note: "Ensure alternative update mechanism is available",
        });
      }

      // Validate Location URLs
      ssaiLocations.forEach((location, index) => {
        if (!this.isValidURL(location)) {
          errors.push({
            severity: "HIGH",
            message: `Invalid Location URL at index ${index}`,
            url: location,
            impact: "Manifest updates may fail",
          });
        }
      });
    }

    return { errors, warnings };
  },

  validatePatchLocationElements(sourceMPD, ssaiMPD) {
    const errors = [];
    const warnings = [];

    const sourcePatchLocations = Array.isArray(sourceMPD.PatchLocation)
      ? sourceMPD.PatchLocation
      : sourceMPD.PatchLocation
      ? [sourceMPD.PatchLocation]
      : [];
    const ssaiPatchLocations = Array.isArray(ssaiMPD.PatchLocation)
      ? ssaiMPD.PatchLocation
      : ssaiMPD.PatchLocation
      ? [ssaiMPD.PatchLocation]
      : [];

    // PatchLocation is used for efficient manifest updates
    if (sourcePatchLocations.length > 0 && ssaiPatchLocations.length === 0) {
      warnings.push({
        severity: "MEDIUM",
        message: "PatchLocation elements removed in SSAI manifest",
        impact: "Efficient manifest patching not available",
        note: "Full manifest downloads will be required",
      });
    }

    // Validate PatchLocation URLs
    ssaiPatchLocations.forEach((patchLocation, index) => {
      if (!this.isValidURL(patchLocation)) {
        warnings.push({
          severity: "MEDIUM",
          message: `Invalid PatchLocation URL at index ${index}`,
          url: patchLocation,
          impact: "Manifest patching may fail",
        });
      }
    });

    return { errors, warnings };
  },

  validateMPDProperties(sourceMPD, ssaiMPD) {
    const errors = [];
    const warnings = [];

    // Validate EssentialProperty at MPD level
    const sourceEssential = Array.isArray(sourceMPD.EssentialProperty)
      ? sourceMPD.EssentialProperty
      : sourceMPD.EssentialProperty
      ? [sourceMPD.EssentialProperty]
      : [];
    const ssaiEssential = Array.isArray(ssaiMPD.EssentialProperty)
      ? ssaiMPD.EssentialProperty
      : ssaiMPD.EssentialProperty
      ? [ssaiMPD.EssentialProperty]
      : [];

    sourceEssential.forEach((prop) => {
      if (!prop) return;
      const ssaiProp = ssaiEssential.find(
        (p) => p && p.schemeIdUri === prop.schemeIdUri
      );
      if (!ssaiProp) {
        errors.push({
          severity: "VERY_HIGH",
          message: `MPD EssentialProperty removed: ${prop.schemeIdUri}`,
          impact:
            "Player MUST understand this property - removal breaks compliance",
          schemeIdUri: prop.schemeIdUri,
          value: prop.value,
        });
      } else if (prop.value && prop.value !== ssaiProp.value) {
        errors.push({
          severity: "VERY_HIGH",
          message: `MPD EssentialProperty value mismatch`,
          schemeIdUri: prop.schemeIdUri,
          expected: prop.value,
          actual: ssaiProp.value,
        });
      }
    });

    // Validate SupplementalProperty at MPD level
    const sourceSupplemental = Array.isArray(sourceMPD.SupplementalProperty)
      ? sourceMPD.SupplementalProperty
      : sourceMPD.SupplementalProperty
      ? [sourceMPD.SupplementalProperty]
      : [];
    const ssaiSupplemental = Array.isArray(ssaiMPD.SupplementalProperty)
      ? ssaiMPD.SupplementalProperty
      : ssaiMPD.SupplementalProperty
      ? [ssaiMPD.SupplementalProperty]
      : [];

    sourceSupplemental.forEach((prop) => {
      if (!prop) return;
      const ssaiProp = ssaiSupplemental.find(
        (p) => p && p.schemeIdUri === prop.schemeIdUri
      );
      if (!ssaiProp) {
        warnings.push({
          severity: "LOW",
          message: `MPD SupplementalProperty removed: ${prop.schemeIdUri}`,
          note: "Optional metadata, not critical for playback",
          schemeIdUri: prop.schemeIdUri,
        });
      }
    });

    return { errors, warnings };
  },

  validateSSAIRequirements(sourceMPD, ssaiMPD) {
    const errors = [];
    const warnings = [];

    // Check for SSAI-specific duration requirements
    if (
      sourceMPD.mediaPresentationDuration &&
      ssaiMPD.mediaPresentationDuration
    ) {
      const sourceDurationResult = this.parseDuration(
        sourceMPD.mediaPresentationDuration,
        "source MPD duration"
      );
      const ssaiDurationResult = this.parseDuration(
        ssaiMPD.mediaPresentationDuration,
        "SSAI MPD duration"
      );

      if (sourceDurationResult.value && ssaiDurationResult.value) {
        // SSAI duration should be >= source duration (due to ad insertion)
        if (ssaiDurationResult.value < sourceDurationResult.value) {
          errors.push({
            severity: "VERY_HIGH",
            message:
              "SSAI duration shorter than source - content may be missing",
            expected: `>= ${sourceDurationResult.value.toFixed(2)}s`,
            actual: `${ssaiDurationResult.value.toFixed(2)}s`,
            impact: "Content truncation detected",
          });
        }

        // Check for reasonable ad insertion ratio
        const durationIncrease =
          ssaiDurationResult.value - sourceDurationResult.value;
        const adRatio = durationIncrease / sourceDurationResult.value;
        if (adRatio > 0.5) {
          // More than 50% increase
          warnings.push({
            severity: "MEDIUM",
            message: `High ad insertion ratio: ${(adRatio * 100).toFixed(1)}%`,
            adDuration: `${durationIncrease.toFixed(2)}s`,
            note: "Verify if ad load is intentional",
          });
        }
      }
    }

    // Check for proportional buffer requirements
    if (sourceMPD.minBufferTime && ssaiMPD.minBufferTime) {
      const sourceBufferResult = this.parseDuration(
        sourceMPD.minBufferTime,
        "source minBufferTime"
      );
      const ssaiBufferResult = this.parseDuration(
        ssaiMPD.minBufferTime,
        "SSAI minBufferTime"
      );

      if (sourceBufferResult.value && ssaiBufferResult.value) {
        // SSAI should maintain proportional buffer time
        const bufferRatio = ssaiBufferResult.value / sourceBufferResult.value;
        if (bufferRatio < 0.8) {
          // Less than 80% of original
          warnings.push({
            severity: "HIGH",
            message: "SSAI significantly reduced buffer time",
            expected: `>= ${(sourceBufferResult.value * 0.8).toFixed(2)}s`,
            actual: `${ssaiBufferResult.value.toFixed(2)}s`,
            impact: "May cause rebuffering during ad transitions",
          });
        }
      }
    }

    return { errors, warnings };
  },
  findMatchingPeriod(sourcePeriod, ssaiPeriods) {
    if (!sourcePeriod || !Array.isArray(ssaiPeriods)) return null;
    let match = ssaiPeriods.find((p) => p && p.id === sourcePeriod.id);
    if (match) return match;

    const sourceStartResult = sourcePeriod.start
      ? this.parseDuration(
          sourcePeriod.start,
          `source period ${sourcePeriod.id || "unknown"} start`
        )
      : { value: 0, error: null };

    match = ssaiPeriods.find((p) => {
      if (!p) return false;
      const ssaiStartResult = p.start
        ? this.parseDuration(p.start, `SSAI period ${p.id || "unknown"} start`)
        : { value: 0, error: null };

      if (sourceStartResult.value === null || ssaiStartResult.value === null)
        return false;
      return Math.abs(sourceStartResult.value - ssaiStartResult.value) < 0.1;
    });
    return match;
  },
  findMatchingAdaptationSet(srcAS, ssaiASArray) {
    if (!srcAS || !Array.isArray(ssaiASArray) || ssaiASArray.length === 0) {
      return null;
    }
    const contentType =
      srcAS.contentType ||
      (srcAS.mimeType ? srcAS.mimeType.split("/")[0] : null);
    const lang = srcAS.lang || "und";
    const role = this.getRoleString(srcAS.Role);
    let match = ssaiASArray.find((ssaiAS) => {
      if (!ssaiAS) return false;
      const ssaiContentType =
        ssaiAS.contentType ||
        (ssaiAS.mimeType ? ssaiAS.mimeType.split("/")[0] : null);
      const ssaiLang = ssaiAS.lang || "und";
      const ssaiRole = this.getRoleString(ssaiAS.Role);
      return (
        contentType === ssaiContentType &&
        lang === ssaiLang &&
        role === ssaiRole
      );
    });
    if (!match) {
      match = ssaiASArray.find((ssaiAS) => {
        if (!ssaiAS) return false;
        const ssaiContentType =
          ssaiAS.contentType ||
          (ssaiAS.mimeType ? ssaiAS.mimeType.split("/")[0] : null);
        const ssaiLang = ssaiAS.lang || "und";
        return contentType === ssaiContentType && lang === ssaiLang;
      });
    }
    return match;
  },
  generateSummary(results) {
    const severityCounts = {
      VERY_HIGH: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };
    results.errors.forEach((err) => {
      if (err && err.severity) {
        severityCounts[err.severity] = (severityCounts[err.severity] || 0) + 1;
      }
    });
    results.warnings.forEach((warn) => {
      if (warn && warn.severity) {
        severityCounts[warn.severity] =
          (severityCounts[warn.severity] || 0) + 1;
      }
    });
    const totalIssues = results.errors.length + results.warnings.length;
    const criticalIssues = severityCounts.VERY_HIGH + severityCounts.HIGH;
    return {
      totalIssues,
      totalErrors: results.errors.length,
      totalWarnings: results.warnings.length,
      criticalIssues,
      severityBreakdown: severityCounts,
      isValid: criticalIssues === 0,
      adPeriodsDetected: results.info.adPeriods || 0,
    };
  },
};
export default SSAIMPDValidator;
