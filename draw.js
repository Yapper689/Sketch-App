import { getStroke } from "https://esm.sh/perfect-freehand";
import { initializeApp } from "https://esm.sh/firebase/app";
// Notice we added 'push' to the imports here
import { getDatabase, ref, set, remove, onChildAdded, onChildChanged, onChildRemoved, onValue, onDisconnect, push } from "https://esm.sh/firebase/database";

const firebaseConfig = {
  databaseURL: "https://draw-c7619-default-rtdb.asia-southeast1.firebasedatabase.app/",
  apiKey: "AIzaSyBzQEY8JVj_hTU5ex4ACeTjPVdTts_Nipg",
  authDomain: "draw-c7619.firebaseapp.com",
  projectId: "draw-c7619",
  storageBucket: "draw-c7619.appspot.com",
  messagingSenderId: "663675275445",
  appId: "1:663675275445:web:f37ce08832229681d956fc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const colorInput = document.getElementById('color-input');
let currentColor = colorInput.value;
let currentSize = 16;
let currentTool = 'draw';
let isOnlineMode = false;
let currentStrokeId = null; // Track the unique ID of the stroke currently being drawn

colorInput.addEventListener('input', () => currentColor = colorInput.value);

document.getElementById('btn-draw').addEventListener('click', () => {
    currentTool = 'draw';
    document.getElementById('btn-draw').classList.add('bg-purple-200', 'dark:bg-slate-600');
    document.getElementById('btn-erase').classList.remove('bg-purple-200', 'dark:bg-slate-600');
    document.getElementById('freehand-canvas').style.cursor = 'crosshair';
    document.querySelectorAll('#freehand-canvas path').forEach(p => p.style.pointerEvents = 'none');
});

document.getElementById('btn-erase').addEventListener('click', () => {
    currentTool = 'erase';
    document.getElementById('btn-erase').classList.add('bg-purple-200', 'dark:bg-slate-600');
    document.getElementById('btn-draw').classList.remove('bg-purple-200', 'dark:bg-slate-600');
    document.getElementById('freehand-canvas').style.cursor = 'cell';
    document.querySelectorAll('#freehand-canvas path').forEach(p => p.style.pointerEvents = 'auto');
});

document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        currentSize = parseInt(e.target.dataset.size);
        document.querySelectorAll('.size-btn').forEach(b => {
            b.classList.remove('bg-purple-700', 'ring-2', 'ring-offset-2', 'ring-purple-300', 'dark:ring-slate-500');
            b.classList.add('bg-slate-400');
        });
        e.target.classList.remove('bg-slate-400');
        e.target.classList.add('bg-purple-700', 'ring-2', 'ring-offset-2', 'ring-purple-300', 'dark:ring-slate-500');
    });
});

function getSvgPathFromStroke(stroke) {
    if (!stroke.length) return '';
    const d = stroke.reduce((acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        }, ['M', ...stroke[0], 'Q']);
    d.push('Z');
    return d.join(' ');
}

let strokes = JSON.parse(localStorage.getItem('storedStrokes')) || [];
let undoStack = [];
let redoStack = [];
const svg = document.querySelector('svg');

const strokesRef = ref(db, 'strokes');
const undoStackRef = ref(db, 'undoStack');
const redoStackRef = ref(db, 'redoStack');

const myPresenceRef = ref(db, `users/${Date.now()}`);
set(myPresenceRef, true);
onDisconnect(myPresenceRef).remove();

onValue(ref(db, 'users'), (snapshot) => {
    const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    document.getElementById('user-count').innerText = `Users: ${count}`;
});

function initializeDatabase() {
    // Listen for new strokes cleanly
    onChildAdded(strokesRef, (snapshot) => {
        let data = snapshot.val();
        let key = snapshot.key;
        
        // Backwards compatibility for old stuck arrays
        if (Array.isArray(data)) { data = { points: data, color: '#000000', size: 16 }; }
        
        const existingIndex = strokes.findIndex(s => s.id === key);
        if (existingIndex === -1) {
            data.id = key;
            strokes.push(data);
            render();
        }
    });

    onChildChanged(strokesRef, (snapshot) => {
        const data = snapshot.val();
        const key = snapshot.key;
        const existingIndex = strokes.findIndex(s => s.id === key);
        if (existingIndex !== -1) {
            strokes[existingIndex] = { ...data, id: key };
            render();
        }
    });

    onChildRemoved(strokesRef, (snapshot) => {
        const key = snapshot.key;
        strokes = strokes.filter(s => s.id !== key);
        render();
    });

    onValue(undoStackRef, (snapshot) => undoStack = snapshot.val() || []);
    onValue(redoStackRef, (snapshot) => redoStack = snapshot.val() || []);
}

const btnOnline = document.getElementById('btn-online');
const onlineIcon = document.getElementById('online-icon');

btnOnline.addEventListener('click', () => {
    isOnlineMode = !isOnlineMode;
    if (isOnlineMode) {
        strokes = []; undoStack = []; redoStack = [];
        localStorage.removeItem('storedStrokes');
        initializeDatabase();
        onlineIcon.classList.remove('fa-handshake-slash');
        onlineIcon.classList.add('fa-handshake');
    } else {
        strokes = []; undoStack = []; redoStack = [];
        render();
        onlineIcon.classList.remove('fa-handshake');
        onlineIcon.classList.add('fa-handshake-slash');
    }
});

svg.addEventListener('pointerdown', PointerDown);
svg.addEventListener('pointermove', PointerMove);

// Eraser Logic 
function deleteStroke(id) {
    const index = strokes.findIndex(s => s.id === id);
    if (index === -1) return;
    
    const strokeToDelete = strokes[index];
    undoStack.push(strokeToDelete);
    if (isOnlineMode) set(undoStackRef, undoStack);

    strokes.splice(index, 1);
    if (isOnlineMode) remove(ref(db, `strokes/${id}`));
    render();
}

function render() {
    svg.innerHTML = ''; 
    
    strokes.forEach((stroke) => {
        if (!stroke) return;
        const points = Array.isArray(stroke) ? stroke : stroke.points;
        const color = Array.isArray(stroke) ? '#000000' : stroke.color;
        const size = Array.isArray(stroke) ? 16 : stroke.size;

        if (!points || points.length === 0) return;

        const pathData = getSvgPathFromStroke(
            getStroke(points.map(p => [p[0], p[1]]), {
                size: size, thinning: 0.5, smoothing: 0.5, streamline: 0.5,
            })
        );

        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', pathData);
        pathEl.setAttribute('fill', color);
        // Bind the precise unique ID instead of the array index
        pathEl.setAttribute('data-id', stroke.id);
        pathEl.style.pointerEvents = currentTool === 'erase' ? 'auto' : 'none';
        svg.appendChild(pathEl);
    });

    if (!isOnlineMode) localStorage.setItem('storedStrokes', JSON.stringify(strokes));
}

function PointerDown(e) {
    if (currentTool === 'erase' && e.target.tagName === 'path') {
        deleteStroke(e.target.getAttribute('data-id'));
        return;
    }

    if (e.buttons === 1 && currentTool === 'draw') {
        redoStack = [];
        if (isOnlineMode) set(redoStackRef, redoStack);
        
        const strokeObj = { points: [[e.pageX, e.pageY, e.pressure]], color: currentColor, size: currentSize };
        
        if (isOnlineMode) {
            const newRef = push(strokesRef);
            currentStrokeId = newRef.key;
            strokeObj.id = currentStrokeId;
            set(newRef, strokeObj);
        } else {
            currentStrokeId = Date.now().toString(); // Unique enough for offline
            strokeObj.id = currentStrokeId;
        }
        
        strokes.push(strokeObj);
        render();
    }
}

function PointerMove(e) {
    if (currentTool === 'erase' && e.buttons === 1) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && el.tagName === 'path') deleteStroke(el.getAttribute('data-id'));
        return;
    }

    if (e.buttons === 1 && currentStrokeId && currentTool === 'draw') {
        const index = strokes.findIndex(s => s.id === currentStrokeId);
        if (index !== -1) {
            strokes[index].points.push([e.pageX, e.pageY, e.pressure]);
            if (isOnlineMode) {
                set(ref(db, `strokes/${currentStrokeId}`), strokes[index]);
            }
            render();
        }
    }
}

// Universal Undo Logic
function Undo() {
    if (strokes.length === 0) return;
    const item = strokes.pop(); 
    
    undoStack.push(item);
    if (isOnlineMode) {
        set(undoStackRef, undoStack);
        remove(ref(db, `strokes/${item.id}`)); 
    }
    render();
}

// Universal Redo Logic
function Redo() {
    if (undoStack.length > 0) {
        const item = undoStack.pop();
        
        if (Array.isArray(item)) { 
            strokes = item;
            if (isOnlineMode) {
                // Ensure clear wipes before re-populating array
                remove(strokesRef).then(() => {
                    item.forEach(s => set(ref(db, `strokes/${s.id}`), s));
                });
            }
        } else { 
            strokes.push(item);
            if (isOnlineMode) set(ref(db, `strokes/${item.id}`), item);
        }
        
        if (isOnlineMode) set(undoStackRef, undoStack);
        render();
    }
}

document.getElementById("btn-clear").addEventListener("click", () => {
    undoStack.push([...strokes]); 
    if (isOnlineMode) set(undoStackRef, undoStack);
    
    strokes = [];
    if (isOnlineMode) {
        // Using 'set(..., null)' instead of 'remove()' forces Firebase to
        // obliterate the node completely, ignoring any corrupted array mapping.
        set(strokesRef, null).catch(err => console.error("Clear failed:", err)); 
    }
    localStorage.removeItem('storedStrokes');
    render();
});

document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'z') { e.preventDefault(); Undo(); } });
document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'y') { e.preventDefault(); Redo(); } });

render();