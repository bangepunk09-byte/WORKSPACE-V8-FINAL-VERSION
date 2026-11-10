import { getAccessToken, googleSignIn } from "./auth";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

/**
 * Extracts a Google Drive folder ID from a URL or raw ID string,
 * and returns both the folderId and a clean direct Google Drive folder URL.
 */
export function parseDriveFolderInput(input = "") {
  const trimmed = String(input || "").trim();
  if (!trimmed) {
    const defaultUrl = "https://drive.google.com/drive/my-drive";
    return {
      folderId: "",
      url: defaultUrl,
      driveUrl: defaultUrl
    };
  }

  // Match /folders/FOLDER_ID
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    const id = folderMatch[1];
    const url = `https://drive.google.com/drive/folders/${id}`;
    return {
      folderId: id,
      url,
      driveUrl: url
    };
  }

  // Match ?id=FOLDER_ID
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    const id = idParamMatch[1];
    const url = `https://drive.google.com/drive/folders/${id}`;
    return {
      folderId: id,
      url,
      driveUrl: url
    };
  }

  // If it's already a full http/https URL (e.g. drive.google.com or docs.google.com)
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      folderId: "",
      url: trimmed,
      driveUrl: trimmed
    };
  }

  // Otherwise treat raw string as folder ID
  const url = `https://drive.google.com/drive/folders/${trimmed}`;
  return {
    folderId: trimmed,
    url,
    driveUrl: url
  };
}

export function getStoredDriveToken() {
  try {
    return sessionStorage.getItem("circle_google_access_token") || localStorage.getItem("circle_google_access_token") || null;
  } catch {
    return null;
  }
}

/**
 * Ensures we have an active Google OAuth access token, triggering Google Sign-In popup if needed.
 */
export async function ensureDriveToken(interactive = true) {
  let token = getStoredDriveToken() || (await getAccessToken());
  if (!token && interactive) {
    const res = await googleSignIn();
    token = res?.accessToken || null;
  }
  if (token) {
    try {
      sessionStorage.setItem("circle_google_access_token", token);
    } catch {}
  }
  return token;
}

/**
 * Lists folders from the user's connected Google Drive.
 */
export async function listGoogleDriveFolders(tokenOrQuery = "", maybeQuery = "") {
  let token = tokenOrQuery;
  let searchQuery = maybeQuery;
  if (!token || token.length < 25) {
    searchQuery = tokenOrQuery;
    token = await ensureDriveToken(false);
  }
  if (!token) throw new Error("Silakan hubungkan akun Google Drive terlebih dahulu");

  let q = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  if (searchQuery && searchQuery.trim()) {
    const safeQ = searchQuery.trim().replace(/'/g, "\\'");
    q += ` and name contains '${safeQ}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: "30",
    fields: "files(id, name, description, webViewLink, iconLink, modifiedTime, shared, owners(displayName, emailAddress))",
    orderBy: "modifiedTime desc"
  });

  const response = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error("Gagal memuat daftar folder dari Google Drive");
  }

  const data = await response.json();
  return Array.isArray(data.files) ? data.files : [];
}

/**
 * Creates a new folder directly in the user's Google Drive and returns its metadata + webViewLink.
 */
export async function createGoogleDriveFolder(tokenOrName, maybeName = "", description = "") {
  let token = tokenOrName;
  let name = maybeName;
  if (!maybeName) {
    name = tokenOrName;
    token = await ensureDriveToken(true);
  }
  if (!token) throw new Error("Silakan hubungkan akun Google terlebih dahulu");

  const response = await fetch(
    `${DRIVE_API_BASE}/files?fields=id,name,description,webViewLink,modifiedTime`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: String(name || "New Folder").trim(),
        description: description.trim() || "Folder dibuat melalui CIRCLE Workspace",
        mimeType: "application/vnd.google-apps.folder"
      })
    }
  );

  if (!response.ok) {
    throw new Error("Gagal membuat folder di Google Drive");
  }

  const folder = await response.json();
  return {
    ...folder,
    webViewLink: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`
  };
}
