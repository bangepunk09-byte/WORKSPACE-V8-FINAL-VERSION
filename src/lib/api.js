import axios from "axios";

export const BASE = "";
export const api = axios.create({ baseURL: `/api`, withCredentials: true });
export const fileUrl = (id) => (id ? `/api/files/${id}` : "");
export const wsUrl = () => `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/ws`;

export function errMsg(e, fallback = "Something went wrong") {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(", ");
  return e?.message || fallback;
}

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post("/upload", fd);
  return data;
}

export async function downloadFrom(path, params, filename) {
  const res = await api.get(path, { params, responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return res;
}
