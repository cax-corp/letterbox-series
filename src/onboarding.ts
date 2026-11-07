export const welcomeKey = "vela-welcome-v1";
export function readWelcomeCompleted() {
  try {
    return localStorage.getItem(welcomeKey) === "done";
  } catch {
    return false;
  }
}
export function markWelcomeCompleted() {
  try {
    localStorage.setItem(welcomeKey, "done");
  } catch {
    // The current session can still continue when storage is unavailable.
  }
}
