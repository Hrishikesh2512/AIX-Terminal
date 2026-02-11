const http = require('http');

// Configuration for LM Studio
const LM_STUDIO_HOST = 'localhost';
const LM_STUDIO_PORT = 1234;
const LM_STUDIO_PATH = '/v1/chat/completions';

async function queryLMStudio(messages) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            messages: messages,
            temperature: 0.7,
            max_tokens: -1,
            stream: false
        });

        const options = {
            hostname: LM_STUDIO_HOST,
            port: LM_STUDIO_PORT,
            path: LM_STUDIO_PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0].message.content;
                        resolve(content);
                    } catch (e) {
                        reject(new Error(`Failed to parse LM Studio response: ${e.message}`));
                    }
                } else {
                    reject(new Error(`LM Studio API Error: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error(`Request error: ${e.message}`));
        });

        req.write(postData);
        req.end();
    });
}

const aiService = {
    processRequest: async (type, prompt, context) => {
        let systemPrompt = "";
        let userPrompt = "";

        if (type === 'command_generation') {
            systemPrompt = "You are an expert Linux terminal assistant. Your goal is to provide the exact command the user is asking for. " +
                "Output ONLY the command, no explanation, no markdown. If there are multiple steps, combine them with &&. " +
                "Use the provided terminal context (history) to understand current directory, recent errors, or active files.";
            userPrompt = `Terminal Context (recent history):\n${context || "No context available."}\n\nUser request: ${prompt}`;
        } else if (type === 'autocomplete') {
            systemPrompt = "You are a terminal autocomplete engine. Predict the rest of the command based on the prefix and history. " +
                "Output ONLY the remaining part of the command (the suffix). No full command, no quotes, no explanation. " +
                "If you can't predict, output nothing.";
            userPrompt = `Terminal Context:\n${context}\n\nCurrent command prefix: "${prompt}"`;
        } else if (type === 'explanation') {
            systemPrompt = "You are a helpful Linux expert. Explain the following command or terminal output clearly and concisely.";
            userPrompt = `Context: ${context}\n\nExplain this: ${prompt}`;
        } else {
            systemPrompt = "You are a helpful AI assistant integrated into a terminal.";
            userPrompt = prompt;
        }

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];

        return await queryLMStudio(messages);
    }
};

module.exports = aiService;
