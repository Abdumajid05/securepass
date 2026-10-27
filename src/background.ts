interface CaptureLoginMessage {
  type: "SECUREPASS_CAPTURE_LOGIN";
  payload: { website: string; username: string; password: string };
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== "securepass-lock-vault") return;
  void chrome.runtime.sendMessage({ type: "SECUREPASS_LOCK_NOW" }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: CaptureLoginMessage, sender, sendResponse) => {
  if (message?.type !== "SECUREPASS_CAPTURE_LOGIN") return;
  const { website, username, password } = message.payload ?? {};
  if (typeof website !== "string" || typeof username !== "string" || typeof password !== "string"
    || website.length > 2048 || username.length > 500 || password.length > 1024 || !password) {
    sendResponse({ ok: false });
    return;
  }
  let senderOrigin = "";
  try { senderOrigin = new URL(sender.url ?? "").origin; } catch { /* Ignore non-web senders. */ }
  if (senderOrigin !== website) {
    sendResponse({ ok: false });
    return;
  }
  void chrome.storage.session.set({ securepassPendingLogin: {
    website, username, password, capturedAt: Date.now(),
  } }).then(() => chrome.action.setBadgeText({ text: "SAVE" }))
    .then(() => chrome.action.setBadgeBackgroundColor({ color: "#1f8a63" }))
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SECUREPASS_GET_PENDING_LOGIN") return;
  let senderOrigin = "";
  try { senderOrigin = new URL(sender.url ?? "").origin; } catch { /* Ignore non-web senders. */ }
  void chrome.storage.session.get("securepassPendingLogin").then((stored) => {
    const pending = stored.securepassPendingLogin as { website?: string; capturedAt?: number } | undefined;
    if (pending && pending.website === senderOrigin && typeof pending.capturedAt === "number"
      && Date.now() - pending.capturedAt < 10 * 60_000) {
      sendResponse({ ok: true, pending });
    } else {
      sendResponse({ ok: true, pending: null });
    }
  }).catch(() => sendResponse({ ok: false, pending: null }));
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SECUREPASS_CLEAR_PENDING") return;
  void chrome.storage.session.remove("securepassPendingLogin")
    .then(() => chrome.action.setBadgeText({ text: "" }))
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
  return true;
});
