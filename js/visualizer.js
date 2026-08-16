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
  ctx.strokeStyle = '#7dd3fc';
  ctx.shadowColor = '#7dd3fc';
  ctx.shadowBlur = 12;
  ctx.beginPath();

  const sliceWidth = width / values.length;
  let x = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const y = (v * 0.4 + 0.5) * height;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  ctx.stroke();
}
