/** Types and functionality for the Dabblebase Realtime client */
import { Channel, Socket } from "phoenix";

/** Event representing a change in the database */
export type DatabaseChangeEvent = {
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
  timestamp: string;
};

/** Information about a user's presence */
export type PresenceUser = {
  online_at: string;
  [key: string]: unknown;
};

/** State representing all current presences */
export type PresenceState = Record<string, { metas: PresenceUser[] }>;

/** Message broadcasted to subscribers */
export type BroadcastMessage = {
  event: string;
  payload: unknown;
  timestamp?: string;
};

/** Represents a WebSocket connection */
type SocketConnection = {
  /** Disconnects the socket connection */
  disconnect: () => void;
};

/** Represents a WebSocket connection for database changes */
export type DbChangesSocketConnection = SocketConnection & {
  /** The underlying Phoenix channel */
  channel: Channel;
};

/** Represents a WebSocket connection for broadcast messages */
export type BroadcastsSocketConnection = SocketConnection & {
  /** Broadcasts a message to all subscribers */
  broadcast: (payload: unknown) => void;
  /** The underlying Phoenix channel */
  channel: Channel;
};

/** Represents a WebSocket connection for presence updates */
export type PresenceSocketConnection = SocketConnection & {
  /** The underlying Phoenix channel */
  channel: Channel;
};

/** Client containing functionality to interact with Dabblebase Realtime */
export type DabblebaseRealtimeClient = {
  /**
   * Listen to database changes for the project.
   *
   * @example
   * ```ts
   * const connection = dabblebase.realtime.listenToDbChanges({
   *   onConnect: () => console.log("✅ Connected to database changes"),
   *   onDbChange: (event) => {
   *     console.log(`${event.operation} on ${event.table}:`, event.record);
   *   }
   * });
   *
   * // Later, disconnect
   * connection.disconnect();
   * ```
   *
   * @param options - database change listening options.
   * - onConnect: called when the database changes connection is successfully established.
   * - onConnectError: called when there is an error connecting to the database changes.
   * - onDbChange: called when a database change event is received.
   */
  listenToDbChanges: (options: {
    onConnect?: () => void;
    onConnectError?: (error: unknown) => void;
    onDbChange?: (payload: DatabaseChangeEvent) => void;
  }) => DbChangesSocketConnection;

  /**
   * Listen for broadcast messages on a specific channel.
   *
   * @example
   * ```ts
   * const connection = dabblebase.realtime.listenForBroadcasts({
   *   channel: "chat",
   *   onConnect: () => console.log("✅ Connected to chat channel"),
   *   onReceiveMessage: (message) => {
   *     console.log("Received broadcast:", message);
   *   }
   * });
   *
   * // Send a message to all subscribers
   * connection.broadcast({ text: "Hello everyone!" });
   *
   * // Later, disconnect
   * connection.disconnect();
   * ```
   *
   * @param options - broadcast listening options.
   * - channel: the name of the broadcast channel to listen to.
   * - onConnect: called when the broadcast connection is successfully established.
   *  - onConnectError: called when there is an error connecting to the broadcast channel.
   * - onReceiveMessage: called when a broadcast message is received.
   */
  listenForBroadcasts: (options: {
    channel: string;
    onConnect?: () => void;
    onConnectError?: (error: unknown) => void;
    onReceiveMessage?: (payload: unknown) => void;
  }) => BroadcastsSocketConnection;

  /**
   * Listen to presence changes for the project.
   *
   * @example
   * ```ts
   * const connection = dabblebase.realtime.listenToPresenceChanges({
   *   onConnect: () => console.log("✅ Connected to presence"),
   *   onReceivePresenceState: (presences) => {
   *     console.log("Current users online:", Object.keys(presences));
   *   },
   *   onPresenceJoin: (userId, presence) => {
   *     console.log(`${userId} joined at ${presence.online_at}`);
   *   },
   *   onPresenceLeave: (userId) => {
   *     console.log(`${userId} left`);
   *   }
   * });
   *
   * // Later, disconnect
   * connection.disconnect();
   * ```
   *
   * @param options - presence listening options.
   * - onConnect: called when the presence connection is successfully established.
   *  - onConnectError: called when there is an error connecting to presence.
   * - onReceivePresenceState: called with the current presence state.
   * - onPresenceJoin: called when a user joins presence.
   * - onPresenceLeave: called when a user leaves presence.
   */
  listenToPresenceChanges: (options: {
    onConnect?: () => void;
    onConnectError?: (error: unknown) => void;
    onReceivePresenceState?: (presenceState: PresenceState) => void;
    onPresenceJoin?: (userId: string, presence: PresenceUser) => void;
    onPresenceLeave?: (userId: string, presence: PresenceUser) => void;
  }) => PresenceSocketConnection;
};

/** Configuration for the Dabblebase Realtime client */
export type RealtimeClientConfiguration = {
  projectId: string;
  realtimeUrl: string;
  projectToken?: string;
  authToken?: string;
  useSecureWebsocketConnection?: boolean;
};

/** Generates the Dabblebase Realtime client based on the provided configuration */
export function createRealtimeClient({
  projectId,
  realtimeUrl,
  projectToken,
  authToken,
  useSecureWebsocketConnection = false,
}: RealtimeClientConfiguration): DabblebaseRealtimeClient {
  // Helper function to get the auth token from cookies
  const getAuthTokenFromCookie = (): string | null => {
    if (typeof document === "undefined") return null;
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "auth-token") {
        const token = decodeURIComponent(value);
        return token;
      }
    }
    return null;
  };

  // Internal function which creates the websocket connection for the route
  const createWebsocket = (): Socket => {
    // Determine the WebSocket URL based on the realtime URL
    const wsUrl = realtimeUrl.replace(/^https?:\/\//, "");
    const protocol = useSecureWebsocketConnection ? "wss" : "ws";
    const socketUrl = `${protocol}://${wsUrl}/ws`;

    // Connection parameters for the socket
    const params: Record<string, string> = {
      project_token: projectToken ?? "",
    };

    // Try to get the current user's auth token from cookies
    const currentAuthToken = authToken || getAuthTokenFromCookie();
    if (currentAuthToken) {
      params.auth_token = currentAuthToken;
      console.log("✅ (dabblebase): Connecting to realtime with auth token");
    } else {
      console.log("⚠️ (dabblebase): Connecting to realtime without auth token");
    }
    return new Socket(socketUrl, { params });
  };

  return {
    listenToDbChanges: ({ onConnect, onConnectError, onDbChange }) => {
      const socket = createWebsocket();
      socket.connect();
      const channel = socket.channel(`db:${projectId}`);

      channel
        .join()
        .receive("ok", () => {
          console.log("✅ (dabblebase): Joined database channel successfully");
          onConnect?.();
        })
        .receive("error", (error) => {
          console.error(
            "❌ (dabblebase): Failed to join database channel:",
            error
          );
          onConnectError?.(error);
          throw new Error(
            "❌ (dabblebase): Unable to connect to the db changes websocket channel."
          );
        });

      channel.on("pg_change", (payload: DatabaseChangeEvent) => {
        onDbChange?.(payload);
      });

      return {
        disconnect: () => {
          channel.leave();
          socket.disconnect();
        },
        channel,
      };
    },

    listenForBroadcasts: ({
      channel: channelName,
      onConnect,
      onConnectError,
      onReceiveMessage,
    }) => {
      const socket = createWebsocket();
      socket.connect();
      const channel = socket.channel(`broadcast:${projectId}:${channelName}`);

      channel
        .join()
        .receive("ok", () => {
          console.log(
            `✅ (dabblebase): Joined broadcast channel '${channelName}' successfully`
          );
          onConnect?.();
        })
        .receive("error", (error) => {
          console.error(
            `❌ (dabblebase): Failed to join broadcast channel '${channelName}':`,
            error
          );
          onConnectError?.(error);
          throw new Error(
            `❌ (dabblebase): Unable to connect to the broadcast websocket channel ${channelName}.`
          );
        });

      channel.on("message", (payload: unknown) => {
        onReceiveMessage?.(payload);
      });

      return {
        broadcast: (payload: unknown) => {
          channel.push("message", { payload });
        },
        disconnect: () => {
          channel.leave();
          socket.disconnect();
        },
        channel,
      };
    },

    listenToPresenceChanges: ({
      onConnect,
      onConnectError,
      onReceivePresenceState,
      onPresenceJoin,
      onPresenceLeave,
    }) => {
      const socket = createWebsocket();
      socket.connect();
      const channel = socket.channel(`presence:${projectId}`);

      channel
        .join()
        .receive("ok", () => {
          console.log("✅ (dabblebase): Joined presence channel successfully");
          onConnect?.();
        })
        .receive("error", (error) => {
          console.error(
            "❌ (dabblebase): Failed to join presence channel:",
            error
          );
          onConnectError?.(error);
          throw new Error(
            `❌ (dabblebase): Unable to connect to the presence websocket channel.`
          );
        });

      // Listen for presence state updates
      channel.on("presence_state", (state: PresenceState) => {
        onReceivePresenceState?.(state);
      });

      // Listen for presence diffs (joins/leaves)
      channel.on(
        "presence_diff",
        (diff: { joins: PresenceState; leaves: PresenceState }) => {
          // Handle joins
          Object.entries(diff.joins).forEach(([userId, { metas }]) => {
            if (metas.length > 0) {
              onPresenceJoin?.(userId, metas[0]);
            }
          });

          // Handle leaves
          Object.entries(diff.leaves).forEach(([userId, { metas }]) => {
            if (metas.length > 0) {
              onPresenceLeave?.(userId, metas[0]);
            }
          });

          // Always sync the current state after diffs
          const combinedState = { ...diff.joins };
          onReceivePresenceState?.(combinedState);
        }
      );

      return {
        disconnect: () => {
          channel.leave();
          socket.disconnect();
        },
        channel,
      };
    },
  };
}
