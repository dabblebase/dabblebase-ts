/** Types and functionality for the Dabblebase Auth client */
import jwt from "jsonwebtoken";

/** Subject representing an authenticated user */
export type AuthSubject = {
  /** Unique ID assigned to a user by Dabblebase Auth */
  id: number;
};

/** Result of the verification of an authentication token */
export type AuthVerificationResult = {
  /** Authenticated user if the authentication token was sucessfully verified */
  subject: AuthSubject | null;
  /** Error if the authentication token could not be successfully verified */
  error: Error | null;
};

/** All supported authentication provider options by Dabblebase Auth */
export type AuthProvider = "unc";

/** Client containing functionality to interact with Dabblebase Auth */
export type DabblebaseAuthClient = {
  /**
   * Attempts to authenticate a user with Dabblebase Auth for a given provider, or
   * creates a new user if none already exists. Once authenticated, Dabblebase Auth
   * places the user's authentication token in cookies for the user and redirects
   * the user to the route provided in the `continueTo` option (or `/` if none is
   * provided)
   *
   * @example
   * Here is an example of using the auth client to sign in on the client side:
   * ```ts
   * dabblebase.auth.signIn({ provider: 'unc', continueTo: '/dashboard' })
   * ```
   * With this call, the user will be redirected to sign in using UNC authentication,
   * then when successfully authenticated, the app will redirect to the `/dashboard`
   * page and the user's authentication token (signed by Dabblebase Auth) is placed
   * as the `auth-token` in cookies.
   *
   * @remark
   * The sign in method should only be used on the client-side (not on the server)
   * and an error will log if a sign in is attempted outside of the client environment.
   *
   * @param options - sign in options.
   *  - provider: authentication provider that the user authenticates with
   *  - continueTo: the route to redirect the user on a successful authentication
   *    (if none is provided, the app redirects to `/` on sign in)
   */
  signIn: (options: { provider?: AuthProvider; continueTo?: string }) => void;

  /**
   * Signs out a user with Dabbblebase auth by removing the auth-token cookie from the
   * user's browser. Once signed out, the user is redirected to the route provided in
   * the `continueTo` option (or `/` if none is provided)
   *
   * @example
   * Here is an example of using the auth client to sign out on the client side:
   * ```ts
   * dabblebase.auth.signOut({ continueTo: '/home' })
   * ```
   * With this call, the user will be redirected to `/home` and the `auth-token` cookie
   * will be cleared.
   *
   * @remark
   * The sign out method should only be used on the client-side (not on the server)
   * and an error will log if a sign out is attempted outside of the client environment.
   *
   * @param options - sign out options.
   *  - continueTo: the route to redirect the user on a successful authentication
   *    (if none is provided, the app redirects to `/` on sign in)
   */
  signOut: (options: { continueTo?: string }) => void;

  /**
   * Verifies that a provided authentication token was signed by Dabblebase for use by
   * a student application.
   *
   * @remark
   * The auth token is verified using the `authVerifyKey` provided when creating the
   * Dabblebase Auth client. If none is provided, an error will be outputted to console.
   *
   * @param authToken - user's authentication token (retrieved from the `auth-token` cookie
   * after a successful sign in), signed by Dabblebase Auth.
   *
   * @returns either a subject (representing the currently authenticated user by its unique ID)
   * or an error. If no `authVerifyKey` is provided, neither a subject nor an error will return.
   */
  verify: (authToken: string | undefined) => AuthVerificationResult;
};

/** Configuration for the Dabblebase Auth client */
export type AuthClientConfiguration = {
  projectId: string;
  projectUrl: string;
  dabblebaseUrl?: string;
  authVerifyKey?: string;
};

/** Generates the Dabblebase Auth client based on the provided configuration */
export function createAuthClient({
  projectId,
  projectUrl,
  dabblebaseUrl,
  authVerifyKey,
}: AuthClientConfiguration): DabblebaseAuthClient {
  return {
    signIn: ({ provider = "unc", continueTo = "/" }): void => {
      // Confirm that this function is called from the client-side.
      if (typeof window === "undefined") {
        throw new Error(
          `❌ (dabblebase): This method must be called from the client-side only (where \`window\` is defined).`,
        );
      }
      // Redirect to dabblebase's project-specific authentication route, which will ultimately redirect back
      // to the client application and set the `auth-token` cookie with the auth token
      // signed by dabblebase using the project's private key.
      window.location.href = `${dabblebaseUrl}/api/project/${projectId}/auth/${provider}?continue_to=${projectUrl}/${continueTo}`;
    },
    signOut: ({ continueTo = "/" }): void => {
      // Confirm that this function is called from the client-side.
      if (typeof window === "undefined") {
        throw new Error(
          `❌ (dabblebase): This method must be called from the client-side only (where \`window\` is defined).`,
        );
      }
      // Redirect to dabblebase's sign out route, which will ultimately redirect back
      // to the client application and remove the `auth-token` cookie.
      window.location.href = `${dabblebaseUrl}/api/project/${projectId}/auth/logout?continue_to=${projectUrl}/${continueTo}`;
    },
    verify: (authToken: string | undefined): AuthVerificationResult => {
      // If no authentication token is provided, the user is not signed in.
      if (!authToken) {
        return {
          subject: null,
          error: new Error("The user is not authenticated."),
        };
      }
      // Verify that the auth token was asymmetrically signed by the dabblebase server using the project's
      // private key by using the project's public key provided to the client.
      if (!authVerifyKey) {
        throw new Error(
          `❌ (dabblebase): Cannot verify the auth token because no auth verification key was provided to dabblebase client.`,
        );
      }
      // Attempt to verify the token using the provided RSA public key.
      try {
        // Format the RSA public key for verification
        const publicKey = `-----BEGIN PUBLIC KEY-----\n${authVerifyKey}\n-----END PUBLIC KEY-----`;
        const payload = jwt.verify(authToken, publicKey, {
          algorithms: ["RS256"],
        });
        const subject = payload as AuthSubject;
        return {
          subject: subject,
          error: null,
        };
      } catch (error) {
        if (error instanceof Error) {
          return {
            subject: null,
            error: new Error(
              `❌ (dabblebase): An error occurred while verifying the auth token. ${error.name}: ${error.message}`,
            ),
          };
        } else {
          return {
            subject: null,
            error: new Error(
              "❌ (dabblebase): An unexpected error occurred while verifying the auth token.",
            ),
          };
        }
      }
    },
  };
}
