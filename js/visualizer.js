let canvas;
let ctx;
let analyser;
let rafId = null;
let resizeListener = null;

export function init(canvasEl, analyserNode) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  analyser = analyserNode;

  resizeCanvas();
  if (resizeListener) {
    window.removeEventListener('resize', resizeListener);
  }
  resizeListener = resizeCanvas;
  window.addEventListener('resize', resizeListener);
}

function resizeCanvas() {
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

export function start() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  draw();
}

export function stop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (ctx) {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }
}

function draw() {
  rafId = requestAnimationFrame(draw);

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const values = analyser.getValue();

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7dd3fc';
  ctx.shadowColor = '#7dd3fc';
  ctx.shadowBlur = 12;
  ctx.beginPath();

  // Downsample the raw waveform into a coarser set of points, then draw a
  // smooth curve through their midpoints (quadratic bezier smoothing) so the
  // trace reads as a flowing curve instead of a jagged, pointy polyline.
  const pointCount = Math.min(96, values.length);
  const samplesPerPoint = values.length / pointCount;
  const points = new Array(pointCount);
  for (let i = 0; i < pointCount; i++) {
    const start = Math.floor(i * samplesPerPoint);
    const end = Math.floor((i + 1) * samplesPerPoint);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < values.length; j++) {
      sum += values[j];
      count++;
    }
    const v = count > 0 ? sum / count : 0;
    points[i] = {
      x: (i / (pointCount - 1)) * width,
      y: (v * 0.4 + 0.5) * height,
    };
  }

  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}
