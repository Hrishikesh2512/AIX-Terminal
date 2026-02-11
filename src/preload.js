const { ipcRenderer } = require('electron');

const api = {
    send: (channel, data) => {
        // whitelist channels
        let validChannels = ['terminal.keystroke', 'terminal.resize', 'terminal.spawn', 'terminal.kill', 'app.close'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        let validChannels = ['terminal.incoming', 'terminal.exit'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    invoke: (channel, data) => {
        let validChannels = ['ai.request'];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    }
};

window.api = api;
