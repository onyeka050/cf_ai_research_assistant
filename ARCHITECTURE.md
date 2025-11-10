# Architecture Documentation

## System Overview

The AI Research Assistant is a serverless, edge-native application built entirely on Cloudflare's platform. It demonstrates modern cloud-native patterns including edge computing, stateful serverless, and distributed AI inference.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Browser                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   HTML UI   │  │  JavaScript  │  │ LocalStorage  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
                         ↓
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Global Network                   │
│                    (300+ Locations)                      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  Cloudflare Worker                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Request Router                       │  │
│  │  • Parse URL path                                 │  │
│  │  • Route to appropriate handler                   │  │
│  │  • Handle CORS                                    │  │
│  └───────────┬───────────┬──────────────┬────────────┘  │
│              │           │              │                │
│      ┌───────▼─────┐ ┌──▼─────┐  ┌────▼──────┐        │
│      │   Serve UI  │ │  Chat  │  │  History  │        │
│      │   Handler   │ │Handler │  │  Handler  │        │
│      └─────────────┘ └────┬───┘  └─────┬─────┘        │
│                            │            │               │
└────────────────────────────┼────────────┼───────────────┘
                             │            │
        ┌────────────────────┴────────────┴───────┐
        │                                          │
        ↓                                          ↓
┌───────────────────┐                    ┌─────────────────┐
│  Durable Object   │                    │   Workers AI    │
│ (Conversation)    │                    │  (Llama 3.3)    │
│                   │                    │                 │
│  ┌─────────────┐  │                    │  ┌───────────┐ │
│  │  Messages   │  │                    │  │ Inference │ │
│  │   Array     │  │                    │  │  Engine   │ │
│  └─────────────┘  │                    │  └───────────┘ │
│                   │                    │                 │
│  ┌─────────────┐  │                    │                 │
│  │ Persistent  │  │                    │                 │
│  │  Storage    │  │                    │                 │
│  └─────────────┘  │                    │                 │
└───────────────────┘                    └─────────────────┘
```

---

## Component Deep Dive

### 1. Client Layer

**Technology:** Vanilla HTML/CSS/JavaScript

**Responsibilities:**
- Render chat interface
- Capture user input
- Display messages in real-time
- Manage conversation ID (localStorage)
- Handle loading states
- Make API calls to Worker

**Key Features:**
- Single-page application (no page reloads)
- Responsive design (mobile-first)
- Optimistic UI updates
- Client-side session management

**Data Flow:**
```
User Input → Validate → Display Optimistically → 
API Call → Wait for Response → Update UI → Store in Storage
```

---

### 2. Worker Layer (Orchestration)

**Technology:** Cloudflare Workers (TypeScript)

**File:** `src/index.ts`

**Responsibilities:**
- HTTP request routing
- API endpoint implementation
- CORS handling
- Error management
- Orchestrate between AI and storage
- Serve static UI

**Endpoints:**

#### `GET /`
- Returns HTML interface
- Single file, no dependencies
- Includes CSS and JavaScript inline

#### `POST /api/chat`
Request:
```json
{
  "message": "User's question",
  "conversationId": "conv_abc123"
}
```

Process:
1. Validate input
2. Get Durable Object stub
3. Store user message
4. Retrieve conversation history
5. Prepare AI context (last 10 messages)
6. Call Workers AI
7. Store AI response
8. Return to client

Response:
```json
{
  "response": "AI's answer",
  "conversationId": "conv_abc123"
}
```

#### `POST /api/history`
Request:
```json
{
  "conversationId": "conv_abc123"
}
```

Response:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": 1699564800000
    },
    {
      "role": "assistant",
      "content": "Hi there!",
      "timestamp": 1699564802000
    }
  ]
}
```

#### `POST /api/clear`
Request:
```json
{
  "conversationId": "conv_abc123"
}
```

Response:
```json
{
  "success": true
}
```

**Error Handling:**
```typescript
try {
  // Operation
} catch (error) {
  return new Response(
    JSON.stringify({ 
      error: "Internal Server Error",
      details: error.message 
    }),
    { status: 500 }
  );
}
```

---

### 3. Durable Objects Layer (State)

**Technology:** Cloudflare Durable Objects

**File:** `src/conversation.ts`

**Purpose:** Persistent, consistent state management per conversation

**Data Model:**
```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ConversationState {
  messages: Message[];
}
```

**Key Features:**
- **Strong Consistency**: Single source of truth per conversation
- **Persistence**: Data survives Worker restarts
- **Isolation**: Each conversation has its own Durable Object
- **Low Latency**: Co-located with Worker

**Lifecycle:**
```
Client Request → Worker identifies conversation →
Worker gets/creates Durable Object → 
Durable Object loads state from storage →
Operation performed → State saved →
Response returned
```

**Why Durable Objects over KV?**

| Feature | Durable Objects | KV |
|---------|----------------|-----|
| Consistency | Strong | Eventual |
| Read-Modify-Write | Atomic | Race conditions |
| Latency | Low | Very low |
| Use Case | Chat state | Static content |

---

### 4. AI Layer

**Technology:** Cloudflare Workers AI

**Model:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

**Configuration:**
```typescript
const aiResponse = await env.AI.run(
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  {
    messages: [
      { role: "user", content: "..." },
      { role: "assistant", content: "..." },
      // ... conversation history
    ],
    max_tokens: 1024,
    temperature: 0.7,
  }
);
```

**Parameters:**
- `max_tokens`: Maximum response length (1024 = ~768 words)
- `temperature`: Randomness (0.7 = balanced creativity/consistency)

**Performance:**
- Inference time: 2-5 seconds
- Runs on GPU at edge
- Globally distributed

**Context Window Management:**
```typescript
// Keep last 10 messages for context
const aiMessages = messages.slice(-10);
```

Why limit to 10?
- Prevents context overflow (Llama 3.3 has 128K token limit)
- Faster inference
- Lower costs
- Most relevant recent context

---

## Data Flow Diagrams

### Chat Message Flow

```
┌─────────┐
│  User   │
└────┬────┘
     │ 1. Type message
     ↓
┌─────────────┐
│  Browser    │
└────┬────────┘
     │ 2. POST /api/chat
     ↓
┌─────────────────────┐
│  Worker (Router)    │
└────┬────────────────┘
     │ 3. Extract conversationId
     ↓
┌─────────────────────────┐
│  Get Durable Object     │
│  (by conversationId)    │
└────┬────────────────────┘
     │ 4. Store user message
     ↓
┌─────────────────────┐
│  Durable Object     │
│  (Conversation)     │
└────┬────────────────┘
     │ 5. Return to Worker
     ↓
┌─────────────────────┐
│  Worker             │
└────┬────────────────┘
     │ 6. Get message history
     ↓
┌─────────────────────┐
│  Durable Object     │
└────┬────────────────┘
     │ 7. Return messages
     ↓
┌─────────────────────┐
│  Worker             │
└────┬────────────────┘
     │ 8. Prepare AI request
     ↓
┌─────────────────────┐
│  Workers AI         │
│  (Llama 3.3)        │
└────┬────────────────┘
     │ 9. Generate response
     ↓
┌─────────────────────┐
│  Worker             │
└────┬────────────────┘
     │ 10. Store AI response
     ↓
┌─────────────────────┐
│  Durable Object     │
└────┬────────────────┘
     │ 11. Return to Worker
     ↓
┌─────────────────────┐
│  Worker             │
└────┬────────────────┘
     │ 12. Return JSON
     ↓
┌─────────────┐
│  Browser    │
└────┬────────┘
     │ 13. Display message
     ↓
┌─────────┐
│  User   │
└─────────┘
```

### State Persistence Flow

```
Browser localStorage
   ↓ (conversationId)
Worker Request
   ↓
Durable Object ID Generation
   ↓ (idFromName)
Get/Create Durable Object Instance
   ↓
Load State from Storage
   ↓
Perform Operations
   ↓
Save State to Storage
   ↓
Return Response
```

---

## Scalability Considerations

### Horizontal Scaling
- **Workers**: Auto-scale to handle any traffic
- **Durable Objects**: One instance per conversation
- **Workers AI**: Scales automatically

### Performance Characteristics

| Component | Cold Start | Warm Latency | Throughput |
|-----------|-----------|--------------|------------|
| Worker | ~5ms | <1ms | Unlimited |
| Durable Object | ~50ms | ~5ms | 1000 req/sec per object |
| Workers AI | N/A | 2-5s | Auto-scaled |

### Bottlenecks

**Potential:**
- AI inference time (2-5s per request)
- Durable Object per-conversation limit (unlikely to hit)

**Mitigations:**
- Streaming responses (future enhancement)
- Response caching (for repeated questions)
- Queue system for high traffic

---

## Security Architecture

### Current Implementation

**Strong Points:**
- HTTPS by default (Cloudflare)
- Edge execution (no centralized server to attack)
- Isolated Durable Objects (no cross-conversation access)
- No credentials stored (Workers AI is automatic)

**Limitations (Demo):**
- No rate limiting
- No authentication
- No input sanitization
- No content filtering

### Production Hardening

**Recommended Additions:**

1. **Rate Limiting**
```typescript
// Check request count per IP
const rateLimiter = await env.RATE_LIMITER.limit({ 
  key: clientIP,
  requests: 10,
  window: 60 
});
```

2. **Authentication**
```typescript
const token = request.headers.get('Authorization');
const user = await verifyToken(token);
```

3. **Input Validation**
```typescript
if (message.length > 1000) {
  return new Response('Message too long', { status: 400 });
}
```

4. **Content Filtering**
```typescript
const isSafe = await moderateContent(message);
if (!isSafe) {
  return new Response('Content not allowed', { status: 400 });
}
```

---

## Cost Architecture

### Cost Breakdown

**Workers:**
- First 100,000 requests/day: Free
- After: $0.50 per million requests

**Durable Objects:**
- First 10,000 requests/day: Free
- After: $0.15 per million requests
- Storage: $0.20/GB-month

**Workers AI:**
- Llama 3.3: ~50 neurons per request
- Pricing varies by model and usage

**Example Monthly Costs:**

| Daily Chats | Worker Requests | DO Requests | AI Cost | Total |
|-------------|-----------------|-------------|---------|-------|
| 100 | Free | Free | $1 | $1 |
| 1,000 | Free | Free | $10 | $10 |
| 10,000 | $15 | $10 | $100 | $125 |

---

## Monitoring & Observability

### Metrics to Track

**Performance:**
- Request latency (p50, p95, p99)
- AI inference time
- Durable Object operation time

**Usage:**
- Requests per second
- Messages per conversation
- Active conversations

**Errors:**
- Error rate by endpoint
- AI failures
- Durable Object errors

### Implementation

```typescript
// Add to Worker
console.log('Request processed', {
  path: url.pathname,
  duration: Date.now() - start,
  conversationId,
});
```

View logs:
```bash
npx wrangler tail
```

---

## Future Enhancements

### Technical Improvements

1. **Streaming Responses**
   - Use Server-Sent Events
   - Show tokens as they're generated
   - Better perceived performance

2. **Advanced Memory**
   - Semantic search over history
   - Summarization of old conversations
   - Long-term memory storage

3. **Multi-Modal Support**
   - Image understanding
   - Document parsing
   - Voice input/output

4. **Workflow Orchestration**
   - Use Cloudflare Workflows
   - Multi-step research tasks
   - Parallel processing

### Architecture Evolution

```
Current:
Browser → Worker → AI
              ↓
         Durable Object

Future:
Browser → Worker → Workflow
              ↓
         Step 1: Classify query
              ↓
         Step 2: Retrieve context
              ↓
         Step 3: Generate response
              ↓
         Step 4: Validate output
              ↓
         Durable Object (state)
```

---

## Design Decisions & Trade-offs

### Decision: Embedded HTML vs Separate Frontend

**Chose:** Embedded HTML

**Pros:**
- Single deploy
- Faster loading (no additional requests)
- Simpler development
- No CORS complexity

**Cons:**
- Less separation of concerns
- Harder to iterate on UI
- Limited framework capabilities

**Alternative:** Cloudflare Pages + Worker API

---

### Decision: Durable Objects vs D1/KV

**Chose:** Durable Objects

**Pros:**
- Strong consistency
- Low latency
- No race conditions
- Co-located with compute

**Cons:**
- More complex
- Higher cost at scale
- Learning curve

**Alternative:** D1 (SQLite) for structured queries

---

### Decision: Llama 3.3 vs External API

**Chose:** Llama 3.3 on Workers AI

**Pros:**
- No API keys needed
- Lower latency (edge)
- Cost-effective
- Integrated platform

**Cons:**
- Less powerful than GPT-4
- Fewer features
- Platform lock-in

**Alternative:** OpenAI API with API key

---

## Testing Strategy

### Unit Tests (Future)
```typescript
import { ConversationManager } from './conversation';

test('stores message', async () => {
  const state = getMockState();
  const conv = new ConversationManager(state);
  
  await conv.addMessage('user', 'Hello');
  
  const messages = await conv.getMessages();
  expect(messages).toHaveLength(1);
});
```

### Integration Tests
```bash
# Test locally
npm run dev

# Make requests
curl http://localhost:8787/api/chat \
  -X POST \
  -d '{"message":"test","conversationId":"test"}'
```

### E2E Tests
```javascript
// Playwright test
test('sends message and receives response', async ({ page }) => {
  await page.goto('http://localhost:8787');
  await page.fill('#messageInput', 'Hello');
  await page.click('#sendButton');
  
  await page.waitForSelector('.message.assistant');
  const response = await page.textContent('.message.assistant');
  
  expect(response).toBeTruthy();
});
```

---

This architecture demonstrates modern cloud-native patterns while remaining simple enough to understand and extend. Each component has a clear responsibility and the system can scale to handle production workloads with minimal modifications.
