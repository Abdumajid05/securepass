(() => {
  if (window.top !== window || !/^https?:$/.test(location.protocol)) return;
  let lastOfferAt = 0;

  function showOffer(payload: { website: string; username: string; password: string }): void {
    if (document.getElementById("securepass-save-offer")) return;
    document.getElementById("securepass-save-offer")?.remove();
    const host = document.createElement("div");
    host.id = "securepass-save-offer";
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:16px;right:16px";
    const shadow = host.attachShadow({ mode: "closed" });
    const card = document.createElement("div");
    card.style.cssText = "font:14px/1.4 system-ui,sans-serif;width:300px;padding:16px;border-radius:12px;background:#fff;color:#172520;box-shadow:0 8px 32px #0003;border:1px solid #dce6df";
    const title = document.createElement("strong");
    title.textContent = "SecurePass — loginni saqlaymizmi?";
    const detail = document.createElement("p");
    detail.textContent = `${payload.username} · ${location.hostname}`;
    detail.style.cssText = "margin:8px 0;color:#66756c;font-size:12px;overflow:hidden;text-overflow:ellipsis";
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px";
    const save = document.createElement("button");
    save.textContent = "Saqlash";
    save.style.cssText = "border:0;border-radius:7px;padding:9px 11px;background:#1f8a63;color:white;font-weight:700;cursor:pointer";
    const dismiss = document.createElement("button");
    dismiss.textContent = "Yo‘q";
    dismiss.style.cssText = "border:1px solid #dce6df;border-radius:7px;padding:9px 11px;background:#fff;color:#35473c;cursor:pointer";
    dismiss.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "SECUREPASS_CLEAR_PENDING" });
      host.remove();
    }, { once: true });
    save.addEventListener("click", () => {
      card.innerHTML = "";
      const confirmation = document.createElement("strong");
      confirmation.textContent = "Taklif saqlandi. SecurePass belgisini bosing va vaultni oching.";
      card.append(confirmation);
    }, { once: true });
    actions.append(save, dismiss);
    card.append(title, detail, actions);
    shadow.append(card);
    document.documentElement.append(host);
  }

  function createOffer(form: HTMLFormElement): void {
    const now = Date.now();
    if (now - lastOfferAt < 1500) return;
    const passwordInput = form.querySelector<HTMLInputElement>('input[type="password"]');
    if (!passwordInput?.value) return;
    const usernameInput = form.querySelector<HTMLInputElement>(
      'input[autocomplete="username"], input[type="email"], input[type="text"]',
    ) ?? document.querySelector<HTMLInputElement>(
      'input[autocomplete="username"], input[type="email"], input[type="text"]',
    );
    const payload = { website: location.origin, username: usernameInput?.value.trim() ?? "", password: passwordInput.value };
    if (!payload.username) return;
    lastOfferAt = now;
    chrome.runtime.sendMessage({ type: "SECUREPASS_CAPTURE_LOGIN", payload }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) return;
      showOffer(payload);
    });
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (form instanceof HTMLFormElement) createOffer(form);
  }, true);

  chrome.runtime.sendMessage({ type: "SECUREPASS_GET_PENDING_LOGIN" }, (response) => {
    if (chrome.runtime.lastError || !response?.pending) return;
    showOffer(response.pending);
  });
})();
