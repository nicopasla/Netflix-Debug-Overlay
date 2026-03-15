# Netflix Debug Overlay

A simple userscript that replaces Netflix debug panel with a clean, more clear overlay.

Used to check to see if Netflix is outputting the quality that you want.

<img width="296" height="731" alt="Screenshot" src="https://github.com/user-attachments/assets/b90e6cce-fc86-40f6-bef7-165ef7450025" />

**VIDEO**
- Resolution
- Bitrate (playing & buffering)
- Buffer size
- Codec
- Frame rate
- VMAF score (playing / buffering)
- HDR support with type if available
- ABR usage
 
**AUDIO**
- Bitrate
- Channels
- Buffer size
- Codec
- Language
 
**NETWORK**
- Throughput
- CDN hostname
- DRM system (Widevine, PlayReady, FairPlay)
- DRM max resolution
 
**PLAYBACK**
- Dropped frames / total frames
- Volume
- Position / duration
  
## Disclaimer
 
This script is **read-only**. It only reads data that Netflix already exposes through their own built-in debug panel. It does not modify Netflix, intercept requests, or change anything about your playback.
 
**This script cannot:**
- Unlock 4K, HDR, or higher resolutions
- Change your audio or video quality
- Bypass DRM restrictions

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) for your browser
2. Click **Raw** on `netflix-debug-overlay.user.js` and Tampermonkey/Violentmonkey will prompt you to install it

## Usage

1. Go to any Netflix watch page
2. Click the Show Debug button

## Notes

- The overlay only appears on `/watch` pages
- The overlay is not visible when fullscreen
- The overlay updates every second
- Use Netflix Sans font when available

## License

MIT