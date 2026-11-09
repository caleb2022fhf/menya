
const { createClient } = require("@libsql/client");
const crypto = require("crypto");

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function initializeDatabase() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            category TEXT NOT NULL,
            profile_image TEXT,
            role TEXT NOT NULL DEFAULT 'student',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

function createSession(user) {
    const payload = Buffer.from(JSON.stringify({
        id: user.id,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 86400
    })).toString("base64url");

    const signature = crypto
        .createHmac("sha256", process.env.SESSION_SECRET)
        .update(payload)
        .digest("base64url");

    return payload + "." + signature;
}

function verifySession(token) {
    if (!token || !process.env.SESSION_SECRET) return null;

    try {
        const parts = token.split(".");
        if (parts.length !== 2) return null;

        const expected = crypto
            .createHmac("sha256", process.env.SESSION_SECRET)
            .update(parts[0])
            .digest();

        const received = Buffer.from(parts[1], "base64url");

        if (
            received.length !== expected.length ||
            !crypto.timingSafeEqual(received, expected)
        ) return null;

        const data = JSON.parse(
            Buffer.from(parts[0], "base64url").toString()
        );

        if (data.exp < Math.floor(Date.now() / 1000)) return null;

        return data;

    } catch {
        return null;
    }
}

function setSessionCookie(res, token) {
    res.setHeader(
        "Set-Cookie",
        `menya_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
    );
}

function getSession(req) {
    const cookies = (req.headers.cookie || "").split(";");

    const sessionCookie = cookies.find(cookie =>
        cookie.trim().startsWith("menya_session=")
    );

    if (!sessionCookie) return null;

    return verifySession(
        sessionCookie.trim().substring("menya_session=".length)
    );
}

module.exports = {
    db,
    initializeDatabase,
    createSession,
    setSessionCookie,
    getSession
};
