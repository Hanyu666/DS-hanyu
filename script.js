class ChatUI {
    constructor() {
        // 初始化设置
        this.settings = {
            apiKey: 'sk-hvKVYYtUshqIuURq32960dAfB5F542288a187cC6E4E87530',
            baseUrl: 'https://blt.to-ai.top',
            model: 'deepseek-r1'
        };

        // 获取DOM元素
        this.messageArea = document.getElementById('messageArea');
        this.userInput = document.getElementById('userInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsModal = document.getElementById('settingsModal');
        this.saveSettings = document.getElementById('saveSettings');
        this.closeSettings = document.getElementById('closeSettings');
        this.clearBtn = document.getElementById('clearBtn');

        // 初始化消息历史数组
        this.messageHistory = [];

        // 设置事件监听
        this.setupEventListeners();
        // 设置Markdown
        this.setupMarkdown();

        // 修改 KaTeX 配置
        this.katexConfig = {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ],
            throwOnError: false,
            strict: false,
            trust: true,
            output: 'html'
        };

        // 等待 KaTeX 加载完成
        this.waitForKaTeX();

        // 初始化 Mermaid
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });
    }

    // 等待 KaTeX 加载
    waitForKaTeX() {
        return new Promise((resolve) => {
            if (window.katex && window.renderMathInElement) {
                resolve();
            } else {
                const checkKaTeX = setInterval(() => {
                    if (window.katex && window.renderMathInElement) {
                        clearInterval(checkKaTeX);
                        resolve();
                    }
                }, 100);
            }
        });
    }

    setupEventListeners() {
        // 发送消息
        this.sendBtn.onclick = () => this.sendMessage();
        this.userInput.onkeypress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        };

        // 设置相关
        this.settingsBtn.onclick = () => this.settingsModal.style.display = 'block';
        this.closeSettings.onclick = () => this.settingsModal.style.display = 'none';
        this.saveSettings.onclick = () => {
            this.settings = {
                apiKey: document.getElementById('apiKey').value,
                baseUrl: document.getElementById('baseUrl').value,
                model: document.getElementById('model').value
            };
            this.settingsModal.style.display = 'none';
        };

        // 点击模态框外部关闭
        window.onclick = (e) => {
            if (e.target === this.settingsModal) {
                this.settingsModal.style.display = 'none';
            }
        };

        // 添加清除按钮事件
        this.clearBtn.onclick = () => this.clearChat();
    }

    setupMarkdown() {
        marked.setOptions({
            renderer: new marked.Renderer(),
            highlight: (code, lang) => {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true,
            gfm: true
        });
    }

    // 修改处理内容的方法
    async processContent(content, element) {
        try {
            // 等待 KaTeX 加载完成
            await this.waitForKaTeX();

            // 先进行 Markdown 渲染
            element.innerHTML = marked.parse(content);

            // 渲染数学公式
            await renderMathInElement(element, this.katexConfig);

            // 渲染 Mermaid 图表
            const mermaidDivs = element.querySelectorAll('.language-mermaid');
            for (const div of mermaidDivs) {
                try {
                    const graph = div.textContent;
                    const uuid = 'mermaid-' + Math.random().toString(36).substr(2, 9);
                    div.id = uuid;
                    const { svg } = await mermaid.render(uuid, graph);
                    div.innerHTML = svg;
                    div.classList.add('mermaid-rendered');
                } catch (err) {
                    console.error('Mermaid rendering error:', err);
                    div.innerHTML = `<div class="error">图表渲染错误: ${err.message}</div>`;
                }
            }

        } catch (error) {
            console.error('Content processing error:', error);
            element.innerHTML = marked.parse(content);
        }
    }

    // 修改添加消息的方法
    async addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message markdown-content`;
        
        // 处理内容
        await this.processContent(content, messageDiv);
        
        this.messageArea.appendChild(messageDiv);
        this.messageArea.scrollTop = this.messageArea.scrollHeight;
        return messageDiv;
    }

    // 添加清除对话方法
    clearChat() {
        if (confirm('确定要清除所有对话吗？')) {
            // 清空消息区域
            this.messageArea.innerHTML = '';
            // 清空消息历史
            this.messageHistory = [];
            // 清空输入框
            this.userInput.value = '';
        }
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        // 添加用户消息到历史
        this.messageHistory.push({ role: 'user', content: message });

        // 添加用户消息
        await this.addMessage(message, 'user');
        this.userInput.value = '';

        // 创建AI消息容器
        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = 'message ai-message';
        this.messageArea.appendChild(aiMessageDiv);

        try {
            const response = await fetch(`${this.settings.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.apiKey}`
                },
                body: JSON.stringify({
                    model: this.settings.model,
                    // 发送完整的对话历史
                    messages: this.messageHistory,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            let thinkingContent = '';
            let finalContent = '';
            let isThinking = false;

            // 创建思考和回答的容器
            const thinkingDiv = document.createElement('div');
            thinkingDiv.className = 'thinking-content markdown-content';
            const finalDiv = document.createElement('div');
            finalDiv.className = 'final-answer markdown-content';
            aiMessageDiv.appendChild(thinkingDiv);
            aiMessageDiv.appendChild(finalDiv);

            let buffer = '';
            let updateTimer = null;
            const updateInterval = 50; // 50ms 更新一次显示

            // 创建一个函数来处理更新显示
            const updateDisplay = async () => {
                // 如果有思考内容，显示思考区域
                if (thinkingContent) {
                    thinkingDiv.style.display = 'block';
                    await this.processContent(thinkingContent, thinkingDiv);
                }
                // 如果有最终内容，显示最终答案区域
                if (finalContent) {
                    finalDiv.style.display = 'block';
                    await this.processContent(finalContent, finalDiv);
                }
                this.messageArea.scrollTop = this.messageArea.scrollHeight;
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += new TextDecoder().decode(value);
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '' || line === 'data: [DONE]') continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const parsed = JSON.parse(line.slice(6));
                            if (parsed.choices && parsed.choices[0]?.delta?.content) {
                                const content = parsed.choices[0].delta.content;

                                if (content.includes('<think>')) {
                                    isThinking = true;
                                    continue;
                                } else if (content.includes('</think>')) {
                                    isThinking = false;
                                    // 不清除思考内容，只是切换状态
                                    continue;
                                }

                                if (isThinking) {
                                    thinkingContent += content;
                                } else {
                                    finalContent += content;
                                }

                                // 使用节流来更新显示
                                clearTimeout(updateTimer);
                                updateTimer = setTimeout(updateDisplay, updateInterval);
                            }
                        } catch (e) {
                            console.error('解析错误:', e);
                        }
                    }
                }
            }

            // 最终更新显示
            clearTimeout(updateTimer);
            await updateDisplay();

            // 添加到历史记录
            this.messageHistory.push({ 
                role: 'assistant', 
                content: finalContent 
            });

        } catch (error) {
            console.error('请求错误:', error);
            aiMessageDiv.innerHTML = `<div class="error">错误: ${error.message}</div>`;
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.chatUI = new ChatUI();
}); 