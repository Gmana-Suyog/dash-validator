/**
 * File System Service for handling MPD file downloads and local file operations
 */

import JSZip from "jszip";

export class FileSystemService {
  constructor() {
    this.downloadFolder = "mpd-downloads";
    this.isElectron = this.checkElectronEnvironment();

    // Continuous monitoring state
    this.monitoringState = {
      isActive: false,
      isPaused: false,
      url: null,
      downloadedFiles: [], // Changed to array to maintain order
      lastCheck: null,
      downloadCount: 0,
      errorCount: 0,
      currentManifest: null,
      currentInterval: null,
      timerId: null,
    };

    // Download queue for batch operations
    this.downloadQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Check if running in Electron environment
   */
  checkElectronEnvironment() {
    return typeof window !== "undefined" && window.electronAPI;
  }

  /**
   * Download MPD file from URL and save to local folder
   */
  async downloadMpdFile(url, filename = null, options = {}) {
    try {
      console.log(`📥 Downloading MPD from: ${url}`);

      // Generate filename if not provided
      if (!filename) {
        filename = this.generateMpdFilename(url);
      }

      // Create AbortController for cancellation support
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeout || 30000
      );

      // Fetch the MPD content with abort signal
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const mpdContent = await response.text();

      // Validate MPD content
      const xmlDoc = this.parseXmlContent(mpdContent);
      const validation = this.validateMpdStructure(xmlDoc);
      if (!validation.valid) {
        throw new Error(`Invalid MPD: ${validation.error}`);
      }

      // Save to file system (browser download)
      const blob = new Blob([mpdContent], { type: "application/dash+xml" });
      const downloadUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      console.log(`✅ MPD downloaded: ${filename}`);
      return {
        success: true,
        filename,
        content: mpdContent,
        size: mpdContent.length,
        validation,
        timestamp: new Date(),
        url: url,
      };
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Download was cancelled");
      }
      console.error("❌ MPD download failed:", error);
      throw new Error(`Failed to download MPD: ${error.message}`);
    }
  }

  /**
   * Start continuous monitoring of a URL for new MPD files with DASH-compliant polling
   */
  startContinuousMonitoring(url, options = {}) {
    if (this.monitoringState.isActive) {
      throw new Error(
        "Monitoring is already active. Stop current monitoring first."
      );
    }

    const config = {
      autoDownload: options.autoDownload !== false, // true by default
      onNewFile: options.onNewFile || (() => {}),
      onError: options.onError || (() => {}),
      onStatusUpdate: options.onStatusUpdate || (() => {}),
      fallbackInterval: 5000, // 5 seconds fallback
    };

    this.monitoringState = {
      isActive: true,
      isPaused: false,
      url: url,
      downloadedFiles: [], // Changed to array to maintain order
      lastCheck: null,
      downloadCount: 0,
      errorCount: 0,
      config: config,
      currentManifest: null,
      currentInterval: null,
      timerId: null,
    };

    console.log(`🔄 Started DASH-compliant monitoring of: ${url}`);
    config.onStatusUpdate({
      status: "started",
      message: `DASH-compliant monitoring started for ${url}`,
      timestamp: new Date(),
    });

    // Perform initial check and start dynamic scheduling
    this.performInitialCheck();

    return {
      success: true,
      monitoringId: Date.now(),
      config: config,
    };
  }

  /**
   * Perform initial MPD check and start dynamic scheduling
   */
  async performInitialCheck() {
    try {
      await this.checkForNewMpd();
      this.scheduleNextCheck();
    } catch (error) {
      console.error("Initial check failed:", error);
      if (this.monitoringState.config.onError) {
        this.monitoringState.config.onError(error);
      }
      // Retry with fallback interval
      setTimeout(
        () => this.scheduleNextCheck(),
        this.monitoringState.config.fallbackInterval
      );
    }
  }

  /**
   * Schedule next MPD check based on DASH-compliant minimumUpdatePeriod
   */
  scheduleNextCheck() {
    if (!this.monitoringState.isActive) return;

    // Clear any existing timer
    if (this.monitoringState.timerId) {
      clearTimeout(this.monitoringState.timerId);
    }

    let nextFetchDelayMs;

    // Extract minimumUpdatePeriod from current MPD (DASH-compliant way)
    const mpdRefreshInterval = this.extractMpdDuration(
      this.monitoringState.currentManifest
    );

    if (mpdRefreshInterval && mpdRefreshInterval > 0) {
      // Use MPD's minimumUpdatePeriod (spec-compliant)
      nextFetchDelayMs = mpdRefreshInterval * 1000;
      this.monitoringState.currentInterval = mpdRefreshInterval;
      console.log(
        `DASH-compliant polling: Next fetch in ${mpdRefreshInterval}s (from minimumUpdatePeriod)`
      );
    } else {
      // Safe fallback for static MPDs or missing minimumUpdatePeriod
      nextFetchDelayMs = this.monitoringState.config.fallbackInterval;
      this.monitoringState.currentInterval =
        this.monitoringState.config.fallbackInterval / 1000;
      console.log(
        `Fallback polling: Next fetch in ${this.monitoringState.currentInterval}s (no minimumUpdatePeriod found)`
      );
    }

    // Add jitter tolerance for production-grade behavior (200ms)
    const jitterMs = 200;
    const totalDelayMs = nextFetchDelayMs + jitterMs;

    // Schedule next fetch
    this.monitoringState.timerId = setTimeout(async () => {
      if (!this.monitoringState.isActive) return;

      // Continue fetching even when paused (data will be queued)
      if (!this.monitoringState.isPaused) {
        try {
          await this.checkForNewMpd();
        } catch (error) {
          console.error("Scheduled check failed:", error);
          this.monitoringState.errorCount++;
          if (this.monitoringState.config.onError) {
            this.monitoringState.config.onError(error);
          }
        }
      }

      // Schedule next check
      this.scheduleNextCheck();
    }, totalDelayMs);
  }

  /**
   * Extract MPD duration/minimumUpdatePeriod from manifest
   */
  extractMpdDuration(manifest) {
    if (!manifest) return null;

    try {
      const mpdElement = manifest.querySelector("MPD");
      if (!mpdElement) return null;

      // Check for minimumUpdatePeriod (spec-compliant way)
      const minimumUpdatePeriod = mpdElement.getAttribute(
        "minimumUpdatePeriod"
      );
      if (minimumUpdatePeriod) {
        const parsedInterval =
          this.parseIsoDurationToSeconds(minimumUpdatePeriod);
        console.log(
          `Found minimumUpdatePeriod: ${minimumUpdatePeriod} = ${parsedInterval}s`
        );
        return parsedInterval;
      }

      console.log("No minimumUpdatePeriod found in MPD");
      return null;
    } catch (error) {
      console.error("Error extracting MPD duration:", error);
      return null;
    }
  }

  /**
   * Parse ISO 8601 duration to seconds
   */
  parseIsoDurationToSeconds(duration) {
    if (!duration) return null;

    try {
      // Handle simple seconds format (e.g., "PT5S")
      const match = duration.match(/PT(\d+(?:\.\d+)?)S/);
      if (match) {
        return parseFloat(match[1]);
      }

      // Handle more complex formats if needed
      const complexMatch = duration.match(
        /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/
      );
      if (complexMatch) {
        const hours = parseInt(complexMatch[1] || 0);
        const minutes = parseInt(complexMatch[2] || 0);
        const seconds = parseFloat(complexMatch[3] || 0);
        return hours * 3600 + minutes * 60 + seconds;
      }

      console.warn("Could not parse ISO duration:", duration);
      return null;
    } catch (error) {
      console.error("Error parsing ISO duration:", error);
      return null;
    }
  }

  /**
   * Pause continuous monitoring
   */
  pauseMonitoring() {
    if (!this.monitoringState.isActive) {
      throw new Error("No active monitoring to pause");
    }

    this.monitoringState.isPaused = true;
    console.log("⏸️ Monitoring paused");

    if (this.monitoringState.config.onStatusUpdate) {
      this.monitoringState.config.onStatusUpdate({
        status: "paused",
        message: "Monitoring paused",
        timestamp: new Date(),
      });
    }

    return { success: true, status: "paused" };
  }

  /**
   * Resume continuous monitoring
   */
  resumeMonitoring() {
    if (!this.monitoringState.isActive) {
      throw new Error("No active monitoring to resume");
    }

    this.monitoringState.isPaused = false;
    console.log("▶️ Monitoring resumed");

    if (this.monitoringState.config.onStatusUpdate) {
      this.monitoringState.config.onStatusUpdate({
        status: "resumed",
        message: "Monitoring resumed",
        timestamp: new Date(),
      });
    }

    return { success: true, status: "active" };
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring() {
    if (!this.monitoringState.isActive) {
      return { success: true, message: "No active monitoring to stop" };
    }

    // Clear timer instead of interval
    if (this.monitoringState.timerId) {
      clearTimeout(this.monitoringState.timerId);
    }

    const stats = {
      downloadCount: this.monitoringState.downloadCount,
      errorCount: this.monitoringState.errorCount,
      duration: this.monitoringState.lastCheck
        ? Date.now() - this.monitoringState.lastCheck
        : 0,
    };

    this.monitoringState = {
      isActive: false,
      isPaused: false,
      timerId: null,
      url: null,
      downloadedFiles: [], // Changed to array
      lastCheck: null,
      downloadCount: 0,
      errorCount: 0,
      currentManifest: null,
      currentInterval: null,
    };

    console.log("🛑 Monitoring stopped");

    return {
      success: true,
      status: "stopped",
      stats: stats,
    };
  }

  /**
   * Check for new MPD file at the monitored URL
   */
  async checkForNewMpd() {
    if (!this.monitoringState.isActive || this.monitoringState.isPaused) {
      return;
    }

    try {
      this.monitoringState.lastCheck = Date.now();

      // Try multiple fetch strategies to handle CORS and other issues
      let mpdContent = null;
      let fetchError = null;

      // Strategy 1: Direct fetch with CORS
      try {
        const response = await fetch(this.monitoringState.url, {
          method: "GET",
          mode: "cors",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
            Accept: "application/dash+xml, application/xml, text/xml, */*",
          },
        });

        if (response.ok) {
          mpdContent = await response.text();
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (corsError) {
        fetchError = corsError;
        console.log("CORS fetch failed:", corsError.message);

        // Strategy 2: Try with different headers
        try {
          const response = await fetch(this.monitoringState.url, {
            method: "GET",
            mode: "cors",
            headers: {
              Accept: "*/*",
            },
          });

          if (response.ok) {
            mpdContent = await response.text();
            console.log("Simplified headers fetch succeeded");
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (simplifiedError) {
          console.log(
            "Simplified headers fetch also failed:",
            simplifiedError.message
          );
        }
      }

      // If we couldn't fetch content, provide helpful error message
      if (!mpdContent) {
        let errorMessage = "Failed to fetch MPD content";

        if (fetchError) {
          if (
            fetchError.name === "TypeError" &&
            fetchError.message.includes("fetch")
          ) {
            errorMessage = `CORS Error: Cannot access ${this.monitoringState.url}. The server must allow cross-origin requests. Try:\n1. Use a CORS proxy service\n2. Ask the server admin to add CORS headers\n3. Use a browser extension to disable CORS (for testing only)`;
          } else if (fetchError.message.includes("NetworkError")) {
            errorMessage = `Network Error: Cannot reach ${this.monitoringState.url}. Check if the URL is correct and accessible.`;
          } else {
            errorMessage = fetchError.message;
          }
        }

        throw new Error(errorMessage);
      }

      // Validate that we got actual MPD content
      if (!mpdContent || mpdContent.trim().length === 0) {
        throw new Error("Empty response received");
      }

      // Check if content looks like XML/MPD
      if (!mpdContent.trim().startsWith("<")) {
        throw new Error("Response does not appear to be XML/MPD content");
      }

      const xmlDoc = this.parseXmlContent(mpdContent);

      // Store current manifest for interval extraction
      this.monitoringState.currentManifest = xmlDoc;

      // Generate a unique filename with timestamp
      const timestamp = new Date();
      const filename = this.generateMpdFilename(
        this.monitoringState.url,
        timestamp
      );

      // Create download result
      const result = {
        success: true,
        filename,
        content: mpdContent,
        size: mpdContent.length,
        timestamp: timestamp,
        url: this.monitoringState.url,
      };

      // Store the file data instead of triggering browser download
      this.monitoringState.downloadedFiles.push({
        filename,
        content: mpdContent,
        size: mpdContent.length,
        timestamp: timestamp,
        url: this.monitoringState.url,
      });

      this.monitoringState.downloadCount++;

      console.log(
        `✅ Auto-saved: ${result.filename} (#${this.monitoringState.downloadCount})`
      );

      // Notify callback
      if (this.monitoringState.config.onNewFile) {
        this.monitoringState.config.onNewFile(result);
      }

      if (this.monitoringState.config.onStatusUpdate) {
        this.monitoringState.config.onStatusUpdate({
          status: "downloaded",
          message: `Downloaded ${result.filename}`,
          timestamp: new Date(),
          downloadCount: this.monitoringState.downloadCount,
          filename: result.filename,
        });
      }
    } catch (error) {
      this.monitoringState.errorCount++;
      console.error("❌ Monitoring check failed:", error);

      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.message.includes("CORS")) {
        errorMessage = `CORS Error: ${this.monitoringState.url} blocks cross-origin requests. The server needs to allow cross-origin access.`;
      } else if (error.message.includes("Failed to fetch")) {
        errorMessage = `Network Error: Cannot reach ${this.monitoringState.url}. Check if the URL is correct and accessible.`;
      }

      if (this.monitoringState.config.onError) {
        this.monitoringState.config.onError(new Error(errorMessage));
      }

      if (this.monitoringState.config.onStatusUpdate) {
        this.monitoringState.config.onStatusUpdate({
          status: "error",
          message: `Error: ${errorMessage}`,
          timestamp: new Date(),
          errorCount: this.monitoringState.errorCount,
        });
      }
    }
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus() {
    return {
      isActive: this.monitoringState.isActive,
      isPaused: this.monitoringState.isPaused,
      url: this.monitoringState.url,
      currentInterval: this.monitoringState.currentInterval,
      downloadCount: this.monitoringState.downloadCount,
      errorCount: this.monitoringState.errorCount,
      lastCheck: this.monitoringState.lastCheck,
      nextCheck:
        this.monitoringState.lastCheck && this.monitoringState.currentInterval
          ? this.monitoringState.lastCheck +
            this.monitoringState.currentInterval * 1000
          : null,
    };
  }

  /**
   * Get all downloaded files
   */
  getDownloadedFiles() {
    return this.monitoringState.downloadedFiles;
  }

  /**
   * Download all collected files as individual files
   */
  async downloadAllFiles() {
    if (this.monitoringState.downloadedFiles.length === 0) {
      throw new Error("No files to download");
    }

    // Download each file individually
    for (const fileData of this.monitoringState.downloadedFiles) {
      const blob = new Blob([fileData.content], {
        type: "application/dash+xml",
      });
      const downloadUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileData.filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      // Small delay between downloads to avoid browser blocking
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `✅ Downloaded ${this.monitoringState.downloadedFiles.length} files`
    );
    return {
      success: true,
      count: this.monitoringState.downloadedFiles.length,
    };
  }

  /**
   * Download all collected files as a single ZIP file
   */
  async downloadAllFilesAsZip() {
    if (this.monitoringState.downloadedFiles.length === 0) {
      throw new Error("No files to download");
    }

    try {
      console.log(
        `📦 Creating ZIP with ${this.monitoringState.downloadedFiles.length} files...`
      );

      // Create a new JSZip instance
      const zip = new JSZip();

      // Add each MPD file to the ZIP
      for (const fileData of this.monitoringState.downloadedFiles) {
        zip.file(fileData.filename, fileData.content);
      }

      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6,
        },
      });

      // Create download filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const zipFilename = `mpd-files_${timestamp}.zip`;

      // Trigger download
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = zipFilename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      console.log(
        `✅ ZIP downloaded: ${zipFilename} (${this.monitoringState.downloadedFiles.length} files)`
      );

      return {
        success: true,
        filename: zipFilename,
        count: this.monitoringState.downloadedFiles.length,
        size: zipBlob.size,
      };
    } catch (error) {
      console.error("❌ ZIP download failed:", error);
      throw new Error(`Failed to create ZIP: ${error.message}`);
    }
  }

  /**
   * Perform sequential comparison like SingleComparison (previous vs current)
   */
  performSequentialComparison() {
    const files = this.monitoringState.downloadedFiles;
    if (files.length < 2) {
      return [];
    }

    const comparisons = [];

    // Compare each file with the previous one (like SingleComparison does)
    for (let i = 1; i < files.length; i++) {
      const previousFile = files[i - 1];
      const currentFile = files[i];

      try {
        // Parse both MPDs
        const previousXml = this.parseXmlContent(previousFile.content);
        const currentXml = this.parseXmlContent(currentFile.content);

        // Create comparison entry
        comparisons.push({
          previousFile: previousFile.filename,
          currentFile: currentFile.filename,
          previousTimestamp: previousFile.timestamp,
          currentTimestamp: currentFile.timestamp,
          previousXml: previousXml,
          currentXml: currentXml,
          previousContent: previousFile.content,
          currentContent: currentFile.content,
        });
      } catch (error) {
        console.error(`Failed to parse files for comparison: ${error.message}`);
      }
    }

    return comparisons;
  }

  /**
   * Read local MPD files using file input
   */
  async readLocalMpdFiles(fileList) {
    const results = [];

    for (const file of fileList) {
      try {
        const content = await this.readFileContent(file);
        const xmlDoc = this.parseXmlContent(content);
        const validation = this.validateMpdStructure(xmlDoc);

        results.push({
          name: file.name,
          size: file.size,
          lastModified: new Date(file.lastModified),
          content,
          xmlDoc,
          validation,
          isLocal: true,
        });
      } catch (error) {
        results.push({
          name: file.name,
          size: file.size,
          lastModified: new Date(file.lastModified),
          error: error.message,
          isLocal: true,
        });
      }
    }

    return results;
  }

  /**
   * Read file content as text
   */
  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  /**
   * Parse XML content to DOM
   */
  parseXmlContent(xmlContent) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

      // Check for parsing errors
      const parserError = xmlDoc.querySelector("parsererror");
      if (parserError) {
        throw new Error(`XML parsing error: ${parserError.textContent}`);
      }

      return xmlDoc;
    } catch (error) {
      console.error("❌ XML parsing failed:", error);
      throw new Error(`Failed to parse XML: ${error.message}`);
    }
  }

  /**
   * Validate MPD file structure
   */
  validateMpdStructure(xmlDoc) {
    try {
      const mpdElement = xmlDoc.querySelector("MPD");
      if (!mpdElement) {
        throw new Error("Invalid MPD: No MPD root element found");
      }

      const periods = xmlDoc.querySelectorAll("Period");
      if (periods.length === 0) {
        throw new Error("Invalid MPD: No Period elements found");
      }

      console.log(`✅ MPD structure valid: ${periods.length} period(s) found`);
      return {
        valid: true,
        periods: periods.length,
        type: mpdElement.getAttribute("type") || "static",
        profiles: mpdElement.getAttribute("profiles") || "unknown",
      };
    } catch (error) {
      console.error("❌ MPD validation failed:", error);
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate unique filename for MPD download
   */
  generateMpdFilename(url, timestamp = null) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, "_");
      const timeStr = timestamp
        ? new Date(timestamp).toISOString().replace(/[:.]/g, "-")
        : new Date().toISOString().replace(/[:.]/g, "-");

      return `${hostname}_${timeStr}.mpd`;
    } catch (error) {
      const timeStr = timestamp
        ? new Date(timestamp).toISOString().replace(/[:.]/g, "-")
        : new Date().toISOString().replace(/[:.]/g, "-");
      return `mpd_${timeStr}.mpd`;
    }
  }

  /**
   * Create a downloadable comparison report
   */
  async downloadComparisonReport(comparisonData, filename = null) {
    try {
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        filename = `dash_validation_report_${timestamp}.json`;
      }

      const reportData = {
        timestamp: new Date().toISOString(),
        tool: "DASH Validator",
        version: "1.0.0",
        comparisonData,
      };

      const jsonContent = JSON.stringify(reportData, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      console.log(`✅ Report downloaded: ${filename}`);
      return { success: true, filename };
    } catch (error) {
      console.error("❌ Report download failed:", error);
      throw new Error(`Failed to download report: ${error.message}`);
    }
  }
}

export default FileSystemService;
