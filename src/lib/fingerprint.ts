export function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(100, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.font = '14px Arial';
    ctx.fillText('CodeXhange™ Fingerprint', 4, 35);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.font = '16px Georgia';
    ctx.fillText('⏐⚡🔒⏐', 4, 55);

    const data = Array.from(ctx.getImageData(0, 0, 256, 64).data).join(',');
    return fnv1a(data);
  } catch {
    return 'canvas-blocked';
  }
}

export function getNavigatorSeed(): string {
  const nav = navigator;
  return [
    nav.userAgent,
    nav.language,
    (nav.languages || []).join(','),
    nav.platform,
    nav.hardwareConcurrency || '',
    (nav as any).deviceMemory || '',
    nav.cookieEnabled,
    (nav as any).doNotTrack || '',
    'ontouchstart' in window,
    nav.maxTouchPoints || 0,
  ].join('|');
}

export function getScreenSeed(): string {
  const s = screen;
  return [s.width, s.height, s.colorDepth, s.pixelDepth].join('x');
}

export function getTimezoneSeed(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone + '|' + new Date().getTimezoneOffset();
}

export function getWebGLSeed(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return 'no-webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return 'no-ext';
    return (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '') + '|' + (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
  } catch {
    return 'blocked';
  }
}

export function getDeviceFingerprint(): string {
  try {
    const canvas = getCanvasFingerprint();
    const nav = getNavigatorSeed();
    const screen = getScreenSeed();
    const tz = getTimezoneSeed();
    const gl = getWebGLSeed();
    const seed = [canvas, nav, screen, tz, gl].join('|||');
    return fnv1a(seed);
  } catch {
    return 'fallback-' + fnv1a(navigator.userAgent + screen.width + screen.height);
  }
}

function fnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
