// Service worker — handles Cognito token refresh and message routing

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.action.openPopup?.();
  }
});

// Relay messages from content script to popup (if open)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_TOKEN") {
    chrome.storage.local.get("cl_token", (r) => sendResponse({ token: r.cl_token || null }));
    return true; // async
  }
  if (msg.type === "GET_RESUME_EMBEDDING") {
    chrome.storage.local.get("cl_resume", (r) => sendResponse({ resume: r.cl_resume || null }));
    return true;
  }
});
