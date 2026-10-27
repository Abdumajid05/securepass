export interface GoogleAccount {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

interface GoogleUserInfo {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
}

export async function getGoogleAccount(interactive: boolean): Promise<GoogleAccount> {
  const { token } = await chrome.identity.getAuthToken({ interactive });
  if (!token) throw new Error("Google’dan kirish tokeni olinmadi. Qayta urinib ko‘ring.");

  let response: Response;
  try {
    response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    throw new Error("Google bilan bog‘lanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.");
  }

  if (response.status === 401) {
    await chrome.identity.removeCachedAuthToken({ token }).catch(() => undefined);
  }
  if (!response.ok) throw new Error("Google hisobini tasdiqlab bo‘lmadi. Qayta urinib ko‘ring.");

  const user = await response.json() as GoogleUserInfo;
  if (typeof user.sub !== "string" || !user.sub
    || typeof user.email !== "string" || !user.email
    || user.email_verified !== true) {
    throw new Error("Google tasdiqlangan email manzilini qaytarmadi.");
  }

  return {
    id: user.sub,
    email: user.email,
    ...(typeof user.name === "string" ? { name: user.name } : {}),
  };
}
