/** Defines the Dabblebase client */

import { createAuthClient, DabblebaseAuthClient } from "./internal/auth";
import {
  createStorageClient,
  DabblebaseStorageClient,
} from "./internal/storage";
import {
  createRealtimeClient,
  DabblebaseRealtimeClient,
} from "./internal/realtime";

// Export all types from internal modules for public use
export type {
  // Auth types
  AuthSubject,
  AuthVerificationResult,
  AuthProvider,
  DabblebaseAuthClient,
  AuthClientConfiguration,
} from "./internal/auth";

export type {
  // Storage types
  DabblebaseStorageClient,
  StorageClientConfiguration,
} from "./internal/storage";

export type {
  // Realtime types
  DatabaseChangeEvent,
  PresenceUser,
  PresenceState,
  BroadcastMessage,
  DbChangesSocketConnection,
  BroadcastsSocketConnection,
  PresenceSocketConnection,
  DabblebaseRealtimeClient,
  RealtimeClientConfiguration,
} from "./internal/realtime";

/** Configuration for the Dabblebase client */
export type ClientConfiguration = {
  projectId: string;
  projectUrl: string;
  dabblebaseUrl?: string;
  authVerifyKey?: string;
  projectToken?: string;
  realtimeUrl?: string;
  useSecureWebsocketConnection?: boolean;
};

/** The Dabblebase client used to interface with core Dabblebase features */
export interface DabblebaseClient {
  /** Authentication client used to interface with Dabblebase Auth */
  auth: DabblebaseAuthClient;
  /** Storage client used to interface with Dabblebase Storage */
  storage: DabblebaseStorageClient;
  /** Realtime client used to interface with Dabblebase Realtime */
  realtime: DabblebaseRealtimeClient;
}

/**
 * Generates the Dabblebase client based on the provided configuration
 *
 * @params config - Dabblebase client configuration.
 *  - dabblebaseUrl: If you are using a different deployment of Dabblebase than
 *    the official one at `www.dabblebase.dev`, provide another URL.
 * - authVerifyKey: Used by the Dabblebase Auth client to verify that a user
 *    has signed in legitimately and correctly.
 * - projectToken: Used to authenticate with Dabblebase Storage and Realtime.
 * - realtimeUrl: URL for the realtime server (defaults to port 8000 on dabblebaseUrl host)
 * - useSecureWebsocketConnection: Whether to use wss:// instead of ws:// for realtime
 */
export function createClient({
  projectId,
  projectUrl,
  dabblebaseUrl = "www.dabblebase.dev",
  authVerifyKey,
  projectToken,
  realtimeUrl,
  useSecureWebsocketConnection = false,
}: ClientConfiguration) {
  // Default realtime URL to port 8000 on the same host as dabblebaseUrl if no realtime URL is given.
  const defaultRealtimeUrl =
    realtimeUrl ||
    dabblebaseUrl?.replace(/:\d+$/, "") + ":8000" ||
    "localhost:8000";

  return {
    auth: createAuthClient({
      projectId,
      projectUrl,
      dabblebaseUrl,
      authVerifyKey,
    }),
    storage: createStorageClient({
      projectId,
      dabblebaseUrl,
      projectToken: projectToken,
    }),
    realtime: createRealtimeClient({
      projectId,
      realtimeUrl: defaultRealtimeUrl,
      projectToken: projectToken,
      useSecureWebsocketConnection,
    }),
  } as DabblebaseClient;
}
