const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const pty = require('node-pty');
const aiService = require('./ai-service');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require('electron-squirrel-startup')) {
//    app.quit();
// }

let mainWindow;
const ptyProcesses = new Map();

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#050a05',
        frame: false,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
        ptyProcesses.forEach(p => p.kill());
        ptyProcesses.clear();
    });
};

function spawnPty(id) {
    const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'];
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env
    });

    ptyProcess.onData((data) => {
        if (mainWindow) {
            mainWindow.webContents.send('terminal.incoming', { id, data });
        }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
        if (mainWindow) {
            mainWindow.webContents.send('terminal.exit', id);
        }
        ptyProcesses.delete(id);
    });

    ptyProcesses.set(id, ptyProcess);
    return ptyProcess;
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.on('terminal.spawn', (event, id) => {
    spawnPty(id);
});

ipcMain.on('terminal.keystroke', (event, { id, data }) => {
    const ptyProcess = ptyProcesses.get(id);
    if (ptyProcess) {
        ptyProcess.write(data);
    }
});

ipcMain.on('terminal.resize', (event, { id, cols, rows }) => {
    const ptyProcess = ptyProcesses.get(id);
    if (ptyProcess) {
        ptyProcess.resize(cols, rows);
    }
});

ipcMain.on('terminal.kill', (event, id) => {
    const ptyProcess = ptyProcesses.get(id);
    if (ptyProcess) {
        ptyProcess.kill();
        ptyProcesses.delete(id);
    }
});

ipcMain.on('app.close', () => {
    app.quit();
});

ipcMain.handle('ai.request', async (event, { type, prompt, context }) => {
    try {
        const response = await aiService.processRequest(type, prompt, context);
        return { success: true, data: response };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
