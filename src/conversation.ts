// Durable Object to manage conversation state and history
export class ConversationManager {
  state: DurableObjectState;
  messages: Array<{ role: string; content: string; timestamp: number }>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.messages = [];
  }

  async initialize() {
    const stored = await this.state.storage.get<Array<{ role: string; content: string; timestamp: number }>>("messages");
    if (stored) {
      this.messages = stored;
    }
  }

  async fetch(request: Request) {
    await this.initialize();

    const url = new URL(request.url);
    const path = url.pathname;

    // Handle different endpoints
    if (path === "/messages" && request.method === "GET") {
      return new Response(JSON.stringify({ messages: this.messages }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/messages" && request.method === "POST") {
      const data = await request.json() as { role: string; content: string };
      const message = {
        role: data.role,
        content: data.content,
        timestamp: Date.now(),
      };

      this.messages.push(message);
      await this.state.storage.put("messages", this.messages);

      return new Response(JSON.stringify({ success: true, message }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/clear" && request.method === "POST") {
      this.messages = [];
      await this.state.storage.delete("messages");

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
}
