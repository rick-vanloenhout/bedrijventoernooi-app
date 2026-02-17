// Determine API base URL:
// - By default, use the current origin (when served via FastAPI at /frontend)
// - When opened directly from disk (file://), fall back to localhost:8000
// - Allow overriding via window.API_BASE for custom deployments
let API_BASE = window.API_BASE || window.location.origin;

if (window.location.origin.startsWith("file:")) {
    API_BASE = window.API_BASE || "http://127.0.0.1:8000";
}

// Ensure no trailing slash to avoid '//' in requests
API_BASE = API_BASE.replace(/\/+$/, "");

function getAuthHeaders() {
    const token = localStorage.getItem("auth_token");
    const headers = { "Content-Type": "application/json" };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

async function parseError(res) {
    const text = await res.text();
    try {
        const json = JSON.parse(text);
        return json.detail || json.message || text;
    } catch {
        return text || `HTTP ${res.status}`;
    }
}

async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: getAuthHeaders()
    });
    if (!res.ok) {
        const msg = await parseError(res);
        throw new Error(msg);
    }
    return res.json();
}

async function apiPost(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const msg = await parseError(res);
        throw new Error(msg);
    }
    return res.json();
}

async function apiDelete(path) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    if (!res.ok) {
        const msg = await parseError(res);
        throw new Error(msg);
    }
}

async function apiPut(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const msg = await parseError(res);
        throw new Error(msg);
    }
    return res.json();
}
