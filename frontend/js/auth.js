// Auth state management
function isLoggedIn() {
    return !!localStorage.getItem("auth_token");
}

function logout() {
    localStorage.removeItem("auth_token");
    window.location.href = "index.html";
}

async function checkAuth() {
    const token = localStorage.getItem("auth_token");
    if (!token) return false;

    try {
        const res = await fetch(`${window.API_BASE || window.location.origin}/auth/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        return res.ok;
    } catch {
        return false;
    }
}
