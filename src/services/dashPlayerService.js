import * as dashjs from "dashjs";

export class DashPlayerService {
  constructor() {
    this.players = new Map();
  }

  createPlayer(type, videoElement, url, onSegmentLoaded, onError) {
    if (this.players.has(type)) {
      this.players.get(type).reset();
    }

    const player = dashjs.MediaPlayer().create();
    player.updateSettings({
      streaming: {
        delay: {
          liveDelay: 4
        },
        fastSwitchEnabled: true
      }
    });

    player.initialize(videoElement, url, true);

    // Set up event listeners
    player.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, (event) => {
      if (event && event.request && event.request.url) {
        const segment = this.processSegmentEvent(event, player);
        onSegmentLoaded(segment);
      }
    });

    player.on(dashjs.MediaPlayer.events.ERROR, (e) => {
      onError(`Playback error for ${type}: ${e?.error?.message || 'Unknown error'}`);
    });

    this.players.set(type, player);
    return player;
  }

  processSegmentEvent(event, player) {
    const req = event.request;
    const dashMetrics = player.getDashMetrics();
    const recentHttpReq = dashMetrics
      .getHttpRequests(req.mediaType || 'video')
      .slice(-1)[0];

    const httpStatus = recentHttpReq ? recentHttpReq.responsecode : null;

    return {
      url: req.url,
      status: httpStatus,
      method: req.method || 'GET',
      type: req.mediaType || 'media',
      time: typeof req.duration === 'number'
        ? req.duration * 1000
        : (event.response && typeof event.response.duration === 'number' ? event.response.duration : null),
      error: httpStatus && ![200, 206, 302].includes(httpStatus) ? this.getErrorReason(httpStatus) : '',
    };
  }

  getErrorReason(status) {
    switch (status) {
      case 404:
        return 'Segment not found. Verify the segment URL or check if the segment file exists on the server.';
      case 403:
        return 'Access forbidden. Check server permissions or authentication requirements.';
      case 500:
        return 'Server error. Check the server logs for issues or retry later.';
      case 503:
        return 'Service unavailable. Server may be down or overloaded; retry later.';
      default:
        return `Unexpected status code ${status}. Investigate server configuration or network issues.`;
    }
  }

  stopPlayer(type) {
    const player = this.players.get(type);
    if (player) {
      player.reset();
      this.players.delete(type);
    }
  }

  getPlayer(type) {
    return this.players.get(type);
  }
}