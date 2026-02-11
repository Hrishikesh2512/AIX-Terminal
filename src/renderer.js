const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');

// Since we are in Electron renderer with nodeIntegration: false, 
// we won't have direct access to 'require' for node modules if we didn't bundle.
// But we are simply referencing them assuming electron-forge or similar bundler, 
// OR simpler: we rely on the fact that we can't require inside the browser directly without a bundler 
// unless we use context isolation + preload to bridge or standard script tags if nodeIntegration was true.
//
// WAIT: The user script uses `require` in renderer.js. 
// For this to work in a raw Electron setup without Webpack/Vite, we usually need:
// 1. `nodeIntegration: true` (less secure) OR
// 2. Pre-bundle this file.
//
// Given the simplicity, I will assume we CANNOT use `require` here directly if contextIsolation is true.
// HOWEVER, xterm.js is a browser library. We can load it via script tag or we can change `main.js` to allow `nodeIntegration: true` for this internal app prototype to simplify things.
//
// Let's check `main.js`: `contextIsolation: true, nodeIntegration: false`. 
// This means `require` is NOT defined here.
//
// FIX: I will modify `index.html` to load `xterm` from `node_modules` if possible, 
// OR I mis-planned. 
// Standard practice for 'simple' Electron apps without bundlers:
// Use `nodeIntegration: true` and `contextIsolation: false` for the prototype to allow `require` in renderer.
// OR
// Use a preload script to expose `require` or the libraries.
//
// Strategy Change: I will update `main.js` to enable `nodeIntegration` for this prototype to make `require('xterm')` work, 
// because setting up Webpack/Vite is a larger task. 
// Actually, `nodeIntegration: true` is deprecated security-wise but easiest for "just make it work" prototypes.
//
// ALTERNATIVE: I will use the Global `Terminal` object if I load the script in HTML.
// But `require` is cleaner. I will switch `main.js` to `nodeIntegration: true` for now in a subsequent step if this fails.
//
// Let's try writing code that assumes `require` works (I'll fix main.js momentarily).

const termTheme = {
    background: 'transparent',
    foreground: '#e0ffe0',
    cursor: '#39ff14',
    selection: 'rgba(57, 255, 20, 0.3)',
    black: '#000000',
    red: '#ff5555',
    green: '#39ff14',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#bfbfbf',
    brightBlack: '#4d4d4d',
    brightRed: '#ff6e67',
    brightGreen: '#5af78e',
    brightYellow: '#f4f99d',
    brightBlue: '#caa9fa',
    brightMagenta: '#ff92d0',
    brightCyan: '#9aedfe',
    brightWhite: '#e6e6e6'
};

const terminals = [];
let activeTerminalIndex = 0;

function createTerminal() {
    const id = Date.now().toString();
    const term = new Terminal({
        fontFamily: '"Fira Code", monospace',
        fontSize: 14,
        theme: termTheme,
        cursorBlink: true,
        allowProposedApi: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const wrapper = document.createElement('div');
    wrapper.className = 'terminal-wrapper';

    const container = document.getElementById('terminal-container');
    container.appendChild(wrapper);

    term.open(wrapper);
    fitAddon.fit();

    // Ensure shortcuts work when terminal is focused
    term.attachCustomKeyEventHandler((e) => {
        if (e.ctrlKey && e.key === 'k') return false; // Allow global listener to catch it
        if (e.ctrlKey && e.shiftKey && e.key === 'N') return false;
        if (e.key === 'Escape' && aiMode) return false;
        return true;
    });

    const terminalObj = { id, term, fitAddon, wrapper, currentInput: '' };
    terminals.push(terminalObj);

    const index = terminals.length - 1;
    setActiveTerminal(index);

    wrapper.addEventListener('mousedown', () => setActiveTerminal(index));

    term.onData(data => {
        if (activeTerminalIndex === index) {
            // Handle Tab Completion
            if (data === '\t' && terminalObj.suggestion) {
                const remaining = terminalObj.suggestion.slice(terminalObj.currentInput.length);
                terminalObj.currentInput = terminalObj.suggestion;
                window.api.send('terminal.keystroke', { id, data: remaining });
                hideGhost();
                return;
            }

            handleInput(terminalObj, data);
            window.api.send('terminal.keystroke', { id, data });
        }
    });

    window.api.send('terminal.spawn', id);
    window.api.send('terminal.resize', { id, cols: term.cols, rows: term.rows });

    updatePanelCount();
    return terminalObj;
}

function closeTerminal(id) {
    const index = terminals.findIndex(t => t.id === id);
    if (index === -1) return;

    // Don't close the last terminal
    if (terminals.length === 1) return;

    const tObj = terminals[index];
    tObj.term.dispose();
    tObj.wrapper.remove();
    terminals.splice(index, 1);

    window.api.send('terminal.kill', id);

    // Set new active terminal
    if (activeTerminalIndex >= terminals.length) {
        setActiveTerminal(terminals.length - 1);
    } else {
        setActiveTerminal(activeTerminalIndex);
    }

    updatePanelCount();
}

function updatePanelCount() {
    const countEl = document.getElementById('active-panels-count');
    if (countEl) {
        countEl.innerText = `PANELS: ${terminals.length}`;
    }
}

const commonCommands = [
    'ls -lah', 'npm install', 'npm start', 'npm run dev', 'git checkout ', 'git commit -m "', 'git push origin ',
    'docker-compose up', 'docker ps -a', 'mkdir -p ', 'cd ..', 'sudo systemctl status ', 'python3 -m venv ',
    'grep -ri "', 'ssh -i ', 'scp ', 'curl -X POST ', 'htop', 'neofetch', 'chmod +x ', 'tail -f '
];

let suggestionTimeout = null;

function handleInput(tObj, data) {
    if (data === '\r') {
        tObj.currentInput = '';
        hideGhost();
    } else if (data === '\u007f') {
        tObj.currentInput = tObj.currentInput.slice(0, -1);
        updateGhost(tObj);
    } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        tObj.currentInput += data;
        updateGhost(tObj);
    }
}

function updateGhost(tObj) {
    if (suggestionTimeout) clearTimeout(suggestionTimeout);

    if (!tObj.currentInput || tObj.currentInput.length < 2) {
        tObj.suggestion = '';
        hideGhost();
        return;
    }

    // First try static commands for instant feeedback
    const staticMatch = commonCommands.find(cmd => cmd.startsWith(tObj.currentInput));
    if (staticMatch && staticMatch !== tObj.currentInput) {
        tObj.suggestion = staticMatch;
        showGhost(tObj.term, staticMatch.slice(tObj.currentInput.length));
    } else {
        // Fallback to AI after 400ms pause
        suggestionTimeout = setTimeout(async () => {
            const context = getActiveTerminalContext();
            try {
                const result = await window.api.invoke('ai.request', {
                    type: 'autocomplete',
                    prompt: tObj.currentInput,
                    context: context
                });

                if (result.success && result.data && result.data.trim()) {
                    const aiSuggestionSuffix = result.data.trim();
                    tObj.suggestion = tObj.currentInput + aiSuggestionSuffix;
                    showGhost(tObj.term, aiSuggestionSuffix);
                }
            } catch (e) {
                console.error("AI Suggestion Error:", e);
            }
        }, 400);
    }
}

function showGhost(term, text) {
    const activeTermObj = terminals[activeTerminalIndex];
    if (!activeTermObj) return;

    const wrapper = activeTermObj.wrapper;
    const rect = wrapper.getBoundingClientRect();

    // Show the FULL suggestion when in a fixed panel, but highlight the prefix
    const prefix = activeTermObj.currentInput;
    ghostSuggestionDiv.innerHTML = `<span style="opacity: 0.5">${prefix}</span>${text}<span class="tab-hint">Tab</span>`;

    // Fixed position: Bottom-left of the terminal panel
    ghostSuggestionDiv.style.left = `${rect.left + 15}px`;
    ghostSuggestionDiv.style.top = `${rect.bottom - 45}px`;
    ghostSuggestionDiv.style.display = 'block';
}

function hideGhost() {
    ghostSuggestionDiv.style.display = 'none';
}

function setActiveTerminal(index) {
    terminals.forEach((t, i) => {
        t.wrapper.classList.toggle('active', i === index);
    });
    activeTerminalIndex = index;
    terminals[index].term.focus();
}

// Initialize first terminal
const initialTerm = createTerminal();

// Welcome Banner
const typeWriter = async (text) => {
    for (const char of text) {
        initialTerm.term.write(char);
        await new Promise(r => setTimeout(r, 5));
    }
    initialTerm.term.write('\r\n');
};

(async () => {
    initialTerm.term.write('\x1b[1;32m● AIX-TERM PRO \x1b[0m\x1b[90m| v1.2.0-stable | AI CORE: ONLINE\x1b[0m\r\n');
    initialTerm.term.write('\x1b[90m─────────────────────────────────────────────────\x1b[0m\r\n');
    initialTerm.term.write('\x1b[36mHotkeys:\x1b[0m \x1b[33mCtrl+K\x1b[0m AI Assistant \x1b[90m|\x1b[0m \x1b[33mCtrl+Shift+N\x1b[0m New Panel \x1b[90m|\x1b[0m \x1b[33mTab\x1b[0m Auto-complete\r\n');
    initialTerm.term.write('\x1b[90mType "exit" to close any panel.\x1b[0m\r\n\r\n');
})();

// Handle Resizing
window.addEventListener('resize', () => {
    terminals.forEach(t => {
        t.fitAddon.fit();
        window.api.send('terminal.resize', { id: t.id, cols: t.term.cols, rows: t.term.rows });
    });
});

// Sync data flow
window.api.receive('terminal.incoming', ({ id, data }) => {
    const t = terminals.find(term => term.id === id);
    if (t) t.term.write(data);
});

window.api.receive('terminal.exit', (id) => {
    closeTerminal(id);
});

// --- Ghost Suggestions UI ---
let ghostContent = '';
const ghostSuggestionDiv = document.createElement('div');
ghostSuggestionDiv.id = 'ghost-suggestion';
document.body.appendChild(ghostSuggestionDiv);

// --- AI Features ---
const aiOverlay = document.getElementById('ai-overlay');
const aiInput = document.getElementById('ai-input');
const aiResponse = document.getElementById('ai-response');
const aiResponseContent = document.querySelector('.response-content');
const aiLoader = document.querySelector('.ai-loader');
const btnRun = document.getElementById('btn-run');
const btnCopy = document.getElementById('btn-copy');
const btnCancel = document.getElementById('btn-cancel');

let aiMode = false;

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'k') {
        toggleAI();
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        createTerminal();
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        const activeTerm = terminals[activeTerminalIndex];
        if (activeTerm) closeTerminal(activeTerm.id);
    }
    if (e.key === 'Escape' && aiMode) {
        closeAI();
    }
});

function toggleAI() {
    // If already open, just clear and refocus for "series" usage
    if (aiMode) {
        aiInput.value = '';
        aiInput.focus();
        aiResponse.classList.add('hidden');
        return;
    }

    aiMode = true;
    aiOverlay.classList.remove('hidden');
    aiInput.focus();
    aiInput.value = '';
    aiResponse.classList.add('hidden');
}

function closeAI() {
    aiMode = false;
    aiOverlay.classList.add('hidden');
    if (terminals[activeTerminalIndex]) {
        terminals[activeTerminalIndex].term.focus();
    }
}

function getActiveTerminalContext() {
    const activeTerm = terminals[activeTerminalIndex];
    if (!activeTerm) return "";

    // Get last 50 lines of visible/history buffer
    const buffer = activeTerm.term.buffer.active;
    let lines = [];
    const startLine = Math.max(0, buffer.baseY + buffer.cursorY - 50);
    const endLine = buffer.baseY + buffer.cursorY;

    for (let i = startLine; i <= endLine; i++) {
        const line = buffer.getLine(i);
        if (line) lines.push(line.translateToString(true));
    }
    return lines.join('\n');
}

aiInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        const prompt = aiInput.value;
        if (!prompt) return;

        aiLoader.classList.remove('hidden');
        aiResponse.classList.add('hidden');

        try {
            const context = getActiveTerminalContext();
            const result = await window.api.invoke('ai.request', {
                type: 'command_generation',
                prompt: prompt,
                context: context
            });

            aiLoader.classList.add('hidden');

            if (result.success) {
                aiResponseContent.innerText = result.data;
                aiResponse.classList.remove('hidden');
                btnRun.focus();
            } else {
                aiResponseContent.innerText = "Error: " + result.error;
                aiResponse.classList.remove('hidden');
            }
        } catch (err) {
            aiLoader.classList.add('hidden');
            aiResponseContent.innerText = "Communication Error: " + err;
            aiResponse.classList.remove('hidden');
        }
    }
});

btnRun.addEventListener('click', () => {
    let command = aiResponseContent.innerText.trim();
    const activeTerm = terminals[activeTerminalIndex];
    if (activeTerm) {
        window.api.send('terminal.keystroke', { id: activeTerm.id, data: command + '\r' });
    }
    closeAI();
});

btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(aiResponseContent.innerText);
    btnCopy.innerText = "Copied!";
    setTimeout(() => btnCopy.innerText = "Copy", 1500);
});

btnCancel.addEventListener('click', () => {
    closeAI();
});

// Window Controls
document.getElementById('btn-close-window').addEventListener('click', () => {
    window.api.send('app.close');
});

