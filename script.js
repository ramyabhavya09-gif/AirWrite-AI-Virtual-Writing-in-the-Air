
const video = document.getElementById("video");

const cameraCanvas = document.getElementById("cameraCanvas");
const cameraCtx = cameraCanvas.getContext("2d");

const drawingCanvas = document.getElementById("drawingCanvas");
const drawCtx = drawingCanvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const status = document.getElementById("status");
const cameraStatus = document.getElementById("cameraStatus");
const placeholder = document.getElementById("cameraPlaceholder");

const brushSize = document.getElementById("brushSize");
const colorButtons = document.querySelectorAll(".color-btn");

const eraserBtn = document.getElementById("eraserBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");

let camera = null;
let cameraRunning = false;

let currentColor = "#8b7bff";
let currentSize = 5;
let eraserMode = false;

let drawing = false;
let previousPoint = null;

let strokes = [];
let currentStroke = null;

// Canvas dimensions
drawingCanvas.width = 800;
drawingCanvas.height = 500;

cameraCanvas.width = 640;
cameraCanvas.height = 480;

// ---------------------------------
// MediaPipe Hand Tracking
// ---------------------------------

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6
});

hands.onResults(onResults);

// ---------------------------------
// Camera
// ---------------------------------

async function startCamera() {

    try {

        startBtn.disabled = true;
        status.textContent = "Starting camera...";

        camera = new Camera(video, {
            onFrame: async () => {
                await hands.send({ image: video });
            },
            width: 640,
            height: 480
        });

        await camera.start();

        cameraRunning = true;

        placeholder.style.display = "none";

        startBtn.disabled = true;
        stopBtn.disabled = false;

        status.textContent = "Camera Online";
        cameraStatus.textContent = "LIVE";

        cameraStatus.style.color = "#4ade80";

    } catch (error) {

        console.error(error);

        status.textContent = "Camera Error";
        startBtn.disabled = false;

        alert(
            "Camera access failed. Allow camera permission and open this website using HTTPS or localhost."
        );
    }
}

function stopCamera() {

    if (camera) {
        camera.stop();
    }

    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }

    cameraRunning = false;
    drawing = false;
    previousPoint = null;
    currentStroke = null;

    cameraCtx.clearRect(
        0, 0,
        cameraCanvas.width,
        cameraCanvas.height
    );

    placeholder.style.display = "flex";

    startBtn.disabled = false;
    stopBtn.disabled = true;

    status.textContent = "Camera Offline";
    cameraStatus.textContent = "OFFLINE";
    cameraStatus.style.color = "#a99cff";
}

// ---------------------------------
// Hand Tracking
// ---------------------------------

function onResults(results) {

    cameraCanvas.width = 640;
    cameraCanvas.height = 480;

    cameraCtx.save();

    // Mirror camera view
    cameraCtx.translate(cameraCanvas.width, 0);
    cameraCtx.scale(-1, 1);

    cameraCtx.drawImage(
        results.image,
        0, 0,
        cameraCanvas.width,
        cameraCanvas.height
    );

    if (
        results.multiHandLandmarks &&
        results.multiHandLandmarks.length > 0
    ) {

        const landmarks = results.multiHandLandmarks[0];

        drawConnectors(
            cameraCtx,
            landmarks,
            HAND_CONNECTIONS,
            {
                color: "#8b7bff",
                lineWidth: 4
            }
        );

        drawLandmarks(
            cameraCtx,
            landmarks,
            {
                color: "#ffffff",
                lineWidth: 2,
                radius: 4
            }
        );

        // Index finger tip
        const indexTip = landmarks[8];

        // Index finger PIP joint
        const indexPIP = landmarks[6];

        // Middle finger tip
        const middleTip = landmarks[12];

        // Middle finger PIP joint
        const middlePIP = landmarks[10];

        // Check index finger is extended
        const indexUp = indexTip.y < indexPIP.y;

        // Check middle finger is folded
        const middleDown = middleTip.y > middlePIP.y;

        // Drawing gesture
        if (indexUp && middleDown) {

            const x = (1 - indexTip.x) * drawingCanvas.width;
            const y = indexTip.y * drawingCanvas.height;

            drawPoint(x, y);

        } else {

            // Stop drawing when gesture changes
            drawing = false;
            previousPoint = null;
            currentStroke = null;
        }

    } else {

        drawing = false;
        previousPoint = null;
        currentStroke = null;
    }

    cameraCtx.restore();
}

// ---------------------------------
// Drawing
// ---------------------------------

function drawPoint(x, y) {

    if (!drawing) {

        drawing = true;

        currentStroke = {
            color: eraserMode ? "#080d19" : currentColor,
            size: currentSize,
            points: []
        };

        strokes.push(currentStroke);
    }

    currentStroke.points.push({ x, y });

    if (previousPoint) {

        drawLine(
            previousPoint.x,
            previousPoint.y,
            x,
            y,
            currentStroke.color,
            currentStroke.size
        );

    } else {

        drawCtx.beginPath();

        drawCtx.arc(
            x, y,
            currentStroke.size / 2,
            0, Math.PI * 2
        );

        drawCtx.fillStyle = currentStroke.color;
        drawCtx.fill();
    }

    previousPoint = { x, y };
}

function drawLine(x1, y1, x2, y2, color, size) {

    drawCtx.beginPath();

    drawCtx.moveTo(x1, y1);
    drawCtx.lineTo(x2, y2);

    drawCtx.strokeStyle = color;
    drawCtx.lineWidth = size;

    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";

    drawCtx.stroke();
}

// ---------------------------------
// Redraw all strokes
// ---------------------------------

function redrawCanvas() {

    drawCtx.clearRect(
        0, 0,
        drawingCanvas.width,
        drawingCanvas.height
    );

    for (const stroke of strokes) {

        if (stroke.points.length === 0) {
            continue;
        }

        drawCtx.beginPath();

        drawCtx.moveTo(
            stroke.points[0].x,
            stroke.points[0].y
        );

        for (let i = 1; i < stroke.points.length; i++) {

            drawCtx.lineTo(
                stroke.points[i].x,
                stroke.points[i].y
            );
        }

        drawCtx.strokeStyle = stroke.color;
        drawCtx.lineWidth = stroke.size;
        drawCtx.lineCap = "round";
        drawCtx.lineJoin = "round";

        drawCtx.stroke();

        // Draw individual point
        if (stroke.points.length === 1) {

            drawCtx.beginPath();

            drawCtx.arc(
                stroke.points[0].x,
                stroke.points[0].y,
                stroke.size / 2,
                0, Math.PI * 2
            );

            drawCtx.fillStyle = stroke.color;
            drawCtx.fill();
        }
    }
}

// ---------------------------------
// Color Selection
// ---------------------------------

colorButtons.forEach(button => {

    button.addEventListener("click", () => {

        colorButtons.forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        currentColor = button.dataset.color;
        eraserMode = false;

        eraserBtn.textContent = "🧹 Eraser";
    });
});

// ---------------------------------
// Brush Size
// ---------------------------------

brushSize.addEventListener("input", () => {

    currentSize = Number(brushSize.value);
});

// ---------------------------------
// Eraser
// ---------------------------------

eraserBtn.addEventListener("click", () => {

    eraserMode = !eraserMode;

    if (eraserMode) {
        eraserBtn.textContent = "✏️ Draw Mode";
    } else {
        eraserBtn.textContent = "🧹 Eraser";
    }
});

// ---------------------------------
// Undo
// ---------------------------------

undoBtn.addEventListener("click", () => {

    if (strokes.length > 0) {

        strokes.pop();

        drawing = false;
        previousPoint = null;
        currentStroke = null;

        redrawCanvas();
    }
});

// ---------------------------------
// Clear Canvas
// ---------------------------------

clearBtn.addEventListener("click", () => {

    strokes = [];

    drawing = false;
    previousPoint = null;
    currentStroke = null;

    drawCtx.clearRect(
        0, 0,
        drawingCanvas.width,
        drawingCanvas.height
    );
});

// ---------------------------------
// Save Drawing
// ---------------------------------

saveBtn.addEventListener("click", () => {

    const link = document.createElement("a");

    link.download = "AirWrite-AI-Drawing.png";

    link.href = drawingCanvas.toDataURL("image/png");

    link.click();
});

// ---------------------------------
// Buttons
// ---------------------------------

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
