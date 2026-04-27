import {
  FilesetResolver,
  GestureRecognizer,
  DrawingUtils
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs';

const MEDIAPIPE_TASKS_VISION_VERSION = '0.10.34';

const GESTURE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17]
];

const NAVIGATION_HINTS = {
  Open_Palm: 'toggle quick actions',
  Closed_Fist: 'confirm/select',
  Pointing_Up: 'focus next',
  Victory: 'move tab right',
  Thumb_Up: 'zoom in',
  Thumb_Down: 'zoom out',
  swipeLeft: 'next component',
  swipeRight: 'previous component'
};

const SWIPE_WINDOW_MS = 520;
const SWIPE_MIN_DISTANCE = 0.18;
const SWIPE_MAX_VERTICAL_DRIFT = 0.14;
const SWIPE_MIN_VELOCITY = 0.55;
const SWIPE_COOLDOWN_MS = 850;

const video = document.getElementById('cameraFeed');
const canvas = document.getElementById('cameraCanvas');
const handSummary = document.getElementById('handSummary');
const gestureLog = document.getElementById('gestureLog');
const statusPill = document.getElementById('statusPill');
const startCameraBtn = document.getElementById('startCameraBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const clearLogBtn = document.getElementById('clearLogBtn');

const ctx = canvas.getContext('2d');
const drawingUtils = new DrawingUtils(ctx);

let recognizer;
let animationFrame;
let cameraStream;
let running = false;
let lastLogStateByHand = new Map();
let motionStateByHand = new Map();
let lastVideoTime = -1;

function setStatus(message, level = '') {
  statusPill.textContent = message;
  statusPill.classList.remove('ok', 'error');
  if (level) statusPill.classList.add(level);
}

function formatScore(score) {
  return `${(score * 100).toFixed(1)}%`;
}

function createEmptyLog() {
  gestureLog.innerHTML = '<p class="log-empty">No gestures recognized yet.</p>';
}

function appendLog(message) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const empty = gestureLog.querySelector('.log-empty');
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className = 'log-item';
  row.innerHTML = `<span class="log-time">${time}</span>${message}`;
  gestureLog.prepend(row);

  const rows = gestureLog.querySelectorAll('.log-item');
  if (rows.length > 120) rows[rows.length - 1].remove();
}

function resizeCanvasToVideo() {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function computeHandInfo(landmarks) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let sumX = 0;
  let sumY = 0;

  for (const point of landmarks) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
    sumX += point.x;
    sumY += point.y;
  }

  const centerX = sumX / landmarks.length;
  const centerY = sumY / landmarks.length;

  return { minX, minY, maxX, maxY, centerX, centerY };
}

function drawHands(results) {
  if (!results.landmarks || !results.landmarks.length) return;

  results.landmarks.forEach((landmarks, index) => {
    const handLabel = results.handedness[index]?.[0]?.displayName || `Hand ${index + 1}`;
    const color = handLabel === 'Left' ? '#66f0ff' : '#ff9f7e';

    drawingUtils.drawConnectors(landmarks, HAND_CONNECTIONS, {
      color,
      lineWidth: 2
    });

    drawingUtils.drawLandmarks(landmarks, {
      color,
      fillColor: color,
      lineWidth: 1.4,
      radius: 2.8
    });

    const info = computeHandInfo(landmarks);
    const x = info.minX * canvas.width;
    const y = info.minY * canvas.height;
    const boxWidth = (info.maxX - info.minX) * canvas.width;
    const boxHeight = (info.maxY - info.minY) * canvas.height;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxWidth, boxHeight);

    ctx.fillStyle = color;
    ctx.font = '600 13px Manrope';
    ctx.fillText(handLabel, x + 6, Math.max(16, y - 8));
  });
}

function renderHandSummary(results) {
  if (!results.landmarks || !results.landmarks.length) {
    handSummary.textContent = 'No hands detected.';
    return;
  }

  handSummary.innerHTML = results.landmarks
    .map((landmarks, index) => {
      const handLabel = results.handedness[index]?.[0]?.displayName || `Hand ${index + 1}`;
      const handScore = results.handedness[index]?.[0]?.score;
      const topGesture = results.gestures[index]?.[0];
      const info = computeHandInfo(landmarks);

      const centerX = (info.centerX * 100).toFixed(1);
      const centerY = (info.centerY * 100).toFixed(1);

      return `
        <article class="hand-card">
          <p class="hand-label">${handLabel} hand ${handScore ? `(${formatScore(handScore)})` : ''}</p>
          <p>Center: x=${centerX}% y=${centerY}%</p>
          <p>Top gesture: ${topGesture ? `${topGesture.categoryName} (${formatScore(topGesture.score)})` : 'None'}</p>
        </article>
      `;
    })
    .join('');
}

function logRecognizedGestures(results, frameTimeMs) {
  const seenHands = new Set();

  if (!results.gestures || !results.gestures.length) {
    return;
  }

  results.gestures.forEach((gestureList, index) => {
    if (!gestureList.length) return;

    const topGesture = gestureList[0];
    if (topGesture.score < 0.55) return;

    const hand = results.handedness[index]?.[0]?.displayName || `Hand ${index + 1}`;
    seenHands.add(hand);

    const state = lastLogStateByHand.get(hand);
    const sameGesture = state && state.gestureName === topGesture.categoryName;
    const msSinceLast = state ? frameTimeMs - state.loggedAt : Number.POSITIVE_INFINITY;

    if (sameGesture && msSinceLast < 1000) return;

    const navHint = NAVIGATION_HINTS[topGesture.categoryName];
    const hintSuffix = navHint ? ` -> ${navHint}` : '';
    appendLog(`${hand}: <strong>${topGesture.categoryName}</strong> (${formatScore(topGesture.score)})${hintSuffix}`);

    lastLogStateByHand.set(hand, {
      gestureName: topGesture.categoryName,
      loggedAt: frameTimeMs
    });
  });

  for (const hand of Array.from(lastLogStateByHand.keys())) {
    if (!seenHands.has(hand)) lastLogStateByHand.delete(hand);
  }
}

function getHandId(results, index) {
  return results.handedness[index]?.[0]?.displayName || `Hand ${index + 1}`;
}

function updateSwipeRecognition(results, frameTimeMs) {
  const seenHands = new Set();

  if (!results.landmarks || !results.landmarks.length) {
    motionStateByHand.clear();
    return;
  }

  results.landmarks.forEach((landmarks, index) => {
    const hand = getHandId(results, index);
    const info = computeHandInfo(landmarks);
    const displayedCenterX = 1 - info.centerX;
    const point = {
      x: displayedCenterX,
      y: info.centerY,
      time: frameTimeMs
    };

    seenHands.add(hand);

    const state =
      motionStateByHand.get(hand) ||
      {
        samples: [],
        lastSwipeAt: Number.NEGATIVE_INFINITY
      };

    state.samples.push(point);
    state.samples = state.samples.filter((sample) => frameTimeMs - sample.time <= SWIPE_WINDOW_MS);

    const first = state.samples[0];
    const dx = point.x - first.x;
    const dy = point.y - first.y;
    const elapsedSeconds = Math.max((point.time - first.time) / 1000, 0.001);
    const velocity = Math.abs(dx) / elapsedSeconds;
    const canSwipe = frameTimeMs - state.lastSwipeAt >= SWIPE_COOLDOWN_MS;

    if (
      canSwipe &&
      Math.abs(dx) >= SWIPE_MIN_DISTANCE &&
      Math.abs(dy) <= SWIPE_MAX_VERTICAL_DRIFT &&
      velocity >= SWIPE_MIN_VELOCITY
    ) {
      const gestureName = dx < 0 ? 'swipeLeft' : 'swipeRight';
      const navHint = NAVIGATION_HINTS[gestureName];
      const hintSuffix = navHint ? ` -> ${navHint}` : '';

      appendLog(`${hand}: <strong>${gestureName}</strong>${hintSuffix}`);

      state.lastSwipeAt = frameTimeMs;
      state.samples = [point];
    }

    motionStateByHand.set(hand, state);
  });

  for (const hand of Array.from(motionStateByHand.keys())) {
    if (!seenHands.has(hand)) motionStateByHand.delete(hand);
  }
}

function renderFrame(nowMs) {
  if (!running) return;

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    resizeCanvasToVideo();

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const results = recognizer.recognizeForVideo(video, nowMs);

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawHands(results);
      ctx.restore();

      renderHandSummary(results);
      logRecognizedGestures(results, nowMs);
      updateSwipeRecognition(results, nowMs);
    }
  }

  animationFrame = requestAnimationFrame(renderFrame);
}

async function createRecognizer() {
  if (recognizer) return recognizer;

  setStatus('Loading MediaPipe models...');

  const vision = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`
  );
  recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: GESTURE_MODEL_URL,
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numHands: 2
  });

  setStatus('Model ready', 'ok');
  return recognizer;
}

async function startCamera() {
  if (running) return;

  try {
    await createRecognizer();

    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    video.srcObject = cameraStream;
    await video.play();

    running = true;
    startCameraBtn.disabled = true;
    stopCameraBtn.disabled = false;
    setStatus('Camera live - detecting gestures', 'ok');
    appendLog('Camera stream started');
    animationFrame = requestAnimationFrame(renderFrame);
  } catch (error) {
    const message = error?.name === 'NotAllowedError' ? 'Camera blocked. Grant permission and try again.' : 'Failed to start camera';
    setStatus(message, 'error');
    appendLog(`<strong>Error:</strong> ${message}`);
  }
}

function stopCamera() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = undefined;

  running = false;
  startCameraBtn.disabled = false;
  stopCameraBtn.disabled = true;

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  video.srcObject = null;
  lastVideoTime = -1;
  lastLogStateByHand.clear();
  motionStateByHand.clear();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  handSummary.textContent = 'No hands detected yet.';
  setStatus('Camera stopped');
  appendLog('Camera stream stopped');
}

startCameraBtn.addEventListener('click', startCamera);
stopCameraBtn.addEventListener('click', stopCamera);
clearLogBtn.addEventListener('click', createEmptyLog);

createEmptyLog();
setStatus('Idle');
