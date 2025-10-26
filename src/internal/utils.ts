/** Internal utilities used by the feature clients. */

const getUserAuthToken = (): string | null => {
  if (typeof document === "undefined" || !document.cookie) {
    console.error("❌ (dabblebase): The user cannot authenticate");
  }
  // Parse cookies to find auth-token
  const cookies = document.cookie.split(";");
  const authTokenCookie = cookies.find((cookie) =>
    cookie.trim().startsWith("auth-token=")
  );
  if (!authTokenCookie) {
    throw new Error("Auth token cookie not found - please log in again");
  }
  // Extract the token value (remove 'auth-token=' prefix)
  const token = authTokenCookie.split("=")[1];

  if (!token || token.trim() === "") {
    throw new Error("Auth token cookie is empty - please log in again");
  }

  return token;
};
