/**
 * api.js — the only file that knows the backend exists.
 *
 * Every other script calls api.get/post/put/patch/del and gets back a
 * parsed JS object. If the backend ever moves (different host, different
 * framework entirely), only API_BASE and the fetch options below need to
 * change — no other frontend code does.
 */
const API_BASE = window.API_BASE || "/api";

async function request(method, path, body) {
  const opts = {
    method,
    credentials: "include", // send the session cookie
    headers: {},
  };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (networkErr) {
    throw { status: 0, message: "Can't reach the server. Check your connection." };
  }

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    /* no body */
  }

  if (!res.ok) {
    throw { status: res.status, message: (data && data.error) || `Request failed (${res.status}).` };
  }
  return data;
}

const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  patch: (path, body) => request("PATCH", path, body),
  del: (path) => request("DELETE", path),
};
