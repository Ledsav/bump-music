let canvas;
let ctx;
let analyser;
let rafId = null;

export function init(canvasEl, analyserNode) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  analyser = analyserNode;
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function draw() {
  rafId = requestAnimationFrame(draw);

  const width = canvas.width;
  const height = canvas.height;
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
