import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { processEmails } from "./index.js";

const app = new Hono();

// Store active SSE clients
const clients = new Set<{
  id: string;
  send: (data: string) => void;
}>();

// Broadcast log message to all connected clients
export function broadcastLog(message: string) {
  clients.forEach((client) => {
    client.send(message);
  });
}

// SSE endpoint for log streaming
app.get("/logs", (c) => {
  const clientId = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      const client = {
        id: clientId,
        send: (message: string) => {
          controller.enqueue(`data: ${JSON.stringify({ type: "log", message })}\n\n`);
        },
      };

      // Add this client to the set of connected clients
      clients.add(client);

      // Send initial connection message
      client.send("Connected to log stream");

      // Remove client when connection closes
      c.req.raw.signal.addEventListener("abort", () => {
        clients.delete(client);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});

// API endpoint to start email processing
app.post("/api/start", async (c) => {
  const config = await c.req.json();
  
  // Validate config
  if (!config.email || !config.password || !config.imapServer) {
    return c.json({ error: "Missing required configuration" }, 400);
  }
  // Start processing in background
  processEmails(config, broadcastLog).catch((error) => {
    broadcastLog(`Error: ${error.message}`);
  });

  return c.json({ status: "started" });
});

// Serve static files from public directory
app.use("/*", serveStatic({ root: "./public" }));

// Start the server
console.log("Server starting on http://localhost:4000");
export default {
  port: 4000,
  fetch: app.fetch,
}; 