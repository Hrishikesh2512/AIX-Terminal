# ⚡ AIX-TERM PRO

> **The Neural Command Core for your Terminal.**

AIX-Term is a local, AI-powered terminal for Linux designed for speed, intelligence, and a premium developer experience. It transforms your raw shell into a context-aware, predictive environment using local LLMs.



## ✨ Features

*   **🧠 Neural Command Core**: Natural language to command generation. Ask "how do I find all logs larger than 10MB?" and get the exact command instantly.
*   **👻 Ghost Suggestions**: Context-aware, AI-powered predictive typing. As you type, AIX-Term predicts the remaining command based on your session history.
*   **🗂️ Multi-Panel Workspace**: Open multiple, independent terminal sessions side-by-side (`Ctrl+Shift+N`).
*   **🛡️ Context Awareness**: The AI understands your current workspace, recent errors, and file structures to provide better assistance.
*   **💎 Premium Glassmorphism UI**: A futuristic, translucent interface with neon accents, CRT scanline effects, and smooth animations.
*   **⌨️ Command-Driven**: Minimalist UI with keyboard-first navigation. Use `exit` to manage panels and `Ctrl+K` for the AI assistant.

## 🚀 Quick Start

### Prerequisites
-   **Node.js** (v16+)
-   **LM Studio** running locally (Host: `localhost:1234`) with a model loaded.

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/AIX-Terminal.git

# Enter the directory
cd AIX-Terminal

# Install dependencies
npm install

# Start the application
npm start
```

## ⌨️ Hotkeys

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` | Open Neural Command Core (AI Assistant) |
| `Ctrl + Shift + N` | Add New Terminal Panel |
| `Tab` | Accept Ghost Suggestion |
| `Escape` | Close AI Overlay |
| `exit` | Close active terminal session |

## 🛠️ Built With

-   **Electron**: Core application framework.
-   **Xterm.js**: High-performance terminal emulator.
-   **Node-PTY**: Pseudo-terminal support.
-   **LM Studio API**: Local LLM integration.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Created with ❤️ for the Linux community.*
