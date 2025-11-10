import { ConversationManager } from './conversation';

// Export the Durable Object
export { ConversationManager };

// Environment bindings
interface Env {
  AI: any; // Workers AI binding
  CONVERSATIONS: DurableObjectNamespace; // Durable Objects binding
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Serve the frontend
      if (path === "/" || path === "/index.html") {
        return new Response(HTML_CONTENT, {
          headers: { 
            "Content-Type": "text/html",
            ...corsHeaders 
          },
        });
      }

      // API endpoint: Chat with AI
      if (path === "/api/chat" && request.method === "POST") {
        const { message, conversationId } = await request.json() as { message: string; conversationId: string };

        // Get or create Durable Object for this conversation
        const id = env.CONVERSATIONS.idFromName(conversationId);
        const stub = env.CONVERSATIONS.get(id);

        // Store user message
        await stub.fetch("https://fake-host/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content: message }),
        });

        // Get conversation history
        const historyResponse = await stub.fetch("https://fake-host/messages");
        const { messages } = await historyResponse.json() as { messages: Array<{ role: string; content: string }> };

        // Prepare messages for AI (limit to last 10 for context window)
        const aiMessages = messages.slice(-10).map(m => ({
          role: m.role,
          content: m.content
        }));

        // Call Workers AI with Llama 3.3
        const aiResponse = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: aiMessages,
          max_tokens: 1024,
          temperature: 0.7,
        });

        const assistantMessage = aiResponse.response;

        // Store assistant response
        await stub.fetch("https://fake-host/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "assistant", content: assistantMessage }),
        });

        return new Response(
          JSON.stringify({ 
            response: assistantMessage,
            conversationId 
          }),
          { 
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders 
            } 
          }
        );
      }

      // API endpoint: Get conversation history
      if (path === "/api/history" && request.method === "POST") {
        const { conversationId } = await request.json() as { conversationId: string };

        const id = env.CONVERSATIONS.idFromName(conversationId);
        const stub = env.CONVERSATIONS.get(id);

        const historyResponse = await stub.fetch("https://fake-host/messages");
        const data = await historyResponse.json();

        return new Response(JSON.stringify(data), {
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          },
        });
      }

      // API endpoint: Clear conversation
      if (path === "/api/clear" && request.method === "POST") {
        const { conversationId } = await request.json() as { conversationId: string };

        const id = env.CONVERSATIONS.idFromName(conversationId);
        const stub = env.CONVERSATIONS.get(id);

        await stub.fetch("https://fake-host/clear", { method: "POST" });

        return new Response(
          JSON.stringify({ success: true }),
          { 
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders 
            } 
          }
        );
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });

    } catch (error) {
      console.error("Error:", error);
      return new Response(
        JSON.stringify({ 
          error: "Internal Server Error",
          details: error instanceof Error ? error.message : String(error)
        }),
        { 
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          } 
        }
      );
    }
  },
};

// Embedded HTML for the chat interface
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Research Assistant</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 800px;
      height: 600px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
    }

    .clear-btn {
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .clear-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .message {
      display: flex;
      gap: 12px;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message.user {
      flex-direction: row-reverse;
    }

    .message-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .message.user .message-avatar {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .message.assistant .message-avatar {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .message-content {
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 12px;
      line-height: 1.5;
    }

    .message.user .message-content {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .message.assistant .message-content {
      background: #f5f5f5;
      color: #333;
    }

    .input-area {
      padding: 20px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 12px;
    }

    #messageInput {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 24px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    #messageInput:focus {
      border-color: #667eea;
    }

    #sendButton {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 24px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: transform 0.2s;
    }

    #sendButton:hover {
      transform: scale(1.05);
    }

    #sendButton:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .loading {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
    }

    .loading-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #667eea;
      animation: bounce 1.4s infinite ease-in-out both;
    }

    .loading-dot:nth-child(1) { animation-delay: -0.32s; }
    .loading-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    .welcome {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    .welcome h2 {
      font-size: 20px;
      margin-bottom: 12px;
      color: #666;
    }

    @media (max-width: 768px) {
      .container {
        height: 100vh;
        border-radius: 0;
      }

      .message-content {
        max-width: 85%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 AI Research Assistant</h1>
      <button class="clear-btn" onclick="clearConversation()">Clear Chat</button>
    </div>
    
    <div id="messages" class="messages">
      <div class="welcome">
        <h2>Welcome to AI Research Assistant</h2>
        <p>Ask me anything! I'm powered by Llama 3.3 on Cloudflare Workers AI.</p>
      </div>
    </div>
    
    <div class="input-area">
      <input 
        type="text" 
        id="messageInput" 
        placeholder="Type your message..." 
        onkeypress="handleKeyPress(event)"
      />
      <button id="sendButton" onclick="sendMessage()">Send</button>
    </div>
  </div>

  <script>
    // Generate a unique conversation ID for this session
    let conversationId = localStorage.getItem('conversationId') || 
                        'conv_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('conversationId', conversationId);

    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    // Load conversation history on page load
    loadHistory();

    async function loadHistory() {
      try {
        const response = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId })
        });
        
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          // Clear welcome message
          messagesDiv.innerHTML = '';
          
          // Display all messages
          data.messages.forEach(msg => {
            addMessageToUI(msg.role, msg.content, false);
          });
          
          scrollToBottom();
        }
      } catch (error) {
        console.error('Error loading history:', error);
      }
    }

    function handleKeyPress(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    }

    async function sendMessage() {
      const message = messageInput.value.trim();
      if (!message) return;

      // Clear input and disable button
      messageInput.value = '';
      sendButton.disabled = true;

      // Clear welcome message if it exists
      const welcome = messagesDiv.querySelector('.welcome');
      if (welcome) {
        welcome.remove();
      }

      // Add user message to UI
      addMessageToUI('user', message);

      // Show loading indicator
      const loadingId = 'loading_' + Date.now();
      addLoadingIndicator(loadingId);

      try {
        // Send message to API
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversationId })
        });

        const data = await response.json();

        // Remove loading indicator
        removeLoadingIndicator(loadingId);

        // Add assistant response to UI
        if (data.response) {
          addMessageToUI('assistant', data.response);
        } else if (data.error) {
          addMessageToUI('assistant', 'Sorry, I encountered an error: ' + data.error);
        }

      } catch (error) {
        removeLoadingIndicator(loadingId);
        addMessageToUI('assistant', 'Sorry, I encountered an error. Please try again.');
        console.error('Error:', error);
      }

      // Re-enable button
      sendButton.disabled = false;
      messageInput.focus();
    }

    function addMessageToUI(role, content, scroll = true) {
      const messageDiv = document.createElement('div');
      messageDiv.className = \`message \${role}\`;

      const avatar = document.createElement('div');
      avatar.className = 'message-avatar';
      avatar.textContent = role === 'user' ? '👤' : '🤖';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.textContent = content;

      messageDiv.appendChild(avatar);
      messageDiv.appendChild(contentDiv);
      messagesDiv.appendChild(messageDiv);

      if (scroll) {
        scrollToBottom();
      }
    }

    function addLoadingIndicator(id) {
      const loadingDiv = document.createElement('div');
      loadingDiv.id = id;
      loadingDiv.className = 'message assistant';

      const avatar = document.createElement('div');
      avatar.className = 'message-avatar';
      avatar.textContent = '🤖';

      const loadingContent = document.createElement('div');
      loadingContent.className = 'message-content loading';
      loadingContent.innerHTML = '<div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div>';

      loadingDiv.appendChild(avatar);
      loadingDiv.appendChild(loadingContent);
      messagesDiv.appendChild(loadingDiv);

      scrollToBottom();
    }

    function removeLoadingIndicator(id) {
      const loading = document.getElementById(id);
      if (loading) {
        loading.remove();
      }
    }

    function scrollToBottom() {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    async function clearConversation() {
      if (!confirm('Are you sure you want to clear this conversation?')) {
        return;
      }

      try {
        await fetch('/api/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId })
        });

        // Clear UI
        messagesDiv.innerHTML = \`
          <div class="welcome">
            <h2>Welcome to AI Research Assistant</h2>
            <p>Ask me anything! I'm powered by Llama 3.3 on Cloudflare Workers AI.</p>
          </div>
        \`;

        // Generate new conversation ID
        conversationId = 'conv_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('conversationId', conversationId);

      } catch (error) {
        console.error('Error clearing conversation:', error);
        alert('Failed to clear conversation');
      }
    }
  </script>
</body>
</html>`;
