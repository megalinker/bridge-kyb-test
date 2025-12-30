// A simple in-memory store to hold events and active SSE clients
// WARNING: This clears on server restart. Use a Database (Postgres/Redis) for production.

export interface BridgeEvent {
  id: string;
  type: string;
  payload: any;
  receivedAt: string;
}

declare global {
  var _eventStore: BridgeEvent[];
  var _clients: Set<ReadableStreamDefaultController>;
}

if (!global._eventStore) global._eventStore = [];
if (!global._clients) global._clients = new Set();

export const eventStore = global._eventStore;
export const clients = global._clients;

export function addEvent(event: BridgeEvent) {
  eventStore.unshift(event); // Add to top
  
  // Notify connected SSE clients
  const message = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach((controller) => {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch (e) {
      console.error("Error sending to client", e);
      clients.delete(controller);
    }
  });
}