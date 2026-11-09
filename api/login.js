
const bcrypt = require("bcryptjs");

const {
    db,
    initializeDatabase,
    createSession,
    setSessionCookie
} = require("./_lib");

function send(res, status, data) {
    res.status(status).json(data);
}

function safeEqual(a, b) {
    const first = Buffer.from(a);
    const second = Buffer.from(b);

    return first.length === second.length &&
        require("crypto").timingSafeEqual(first, second);
}

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        return send(res, 405, {
            success: false,
            message: "Method not allowed."
        });
    }

    try {
        if (
            !process.env.TURSO_DATABASE_URL ||
            !process.env.TURSO_AUTH_TOKEN ||
            !process.env.SESSION_SECRET ||
            !process.env.ADMIN_EMAIL ||
            !process.env.ADMIN_PASSWORD
        ) {
            throw new Error("Server environment is incomplete.");
        }

        await initializeDatabase();

        const { identity, password } = req.body || {};

        if (!identity || !password) {
            return send(res, 400, {
                success: false,
                message: "Enter your email and password."
            });
        }

        const email = process.env.ADMIN_EMAIL.trim().toLowerCase();

        // ADMIN LOGIN
        if (
            identity.trim().toLowerCase() === email &&
            safeEqual(password, process.env.ADMIN_PASSWORD)
        ) {
            const hash = await bcrypt.hash(
                process.env.ADMIN_PASSWORD,
                12
            );

            const result = await db.execute({
                sql: `
                    INSERT INTO users
                    (username, email, password_hash, category, role)
                    VALUES (?, ?, ?, 'Administration', 'admin')
                    ON CONFLICT(email) DO UPDATE SET
                    password_hash = excluded.password_hash,
                    role = 'admin'
                `,
                args: ["MENYA Administrator", email, hash]
            });

            const admin = await db.execute({
                sql: "SELECT id, username, email, role FROM users WHERE email = ?",
                args: [email]
            });

            const user = admin.rows[0];

            const token = createSession(user);
            setSessionCookie(res, token);

            return send(res, 200, {
                success: true,
                role: "admin",
                message: "Admin login successful."
            });
        }

        // STUDENT LOGIN
        const result = await db.execute({
            sql: `
                SELECT id, username, email, password_hash, role
                FROM users
                WHERE LOWER(username) = LOWER(?)
                   OR LOWER(email) = LOWER(?)
                LIMIT 1
            `,
            args: [identity.trim(), identity.trim()]
        });

        if (result.rows.length === 0) {
            return send(res, 401, {
                success: false,
                message: "Account not found."
            });
        }

        const user = result.rows[0];

        const validPassword = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!validPassword || user.role !== "student") {
            return send(res, 401, {
                success: false,
                message: "Username or password is incorrect."
            });
        }

        const token = createSession(user);
        setSessionCookie(res, token);

        return send(res, 200, {
            success: true,
            role: "student",
            message: "Login successful."
        });

    } catch (error) {
        console.error("MENYA LOGIN ERROR:", error);

        return send(res, 500, {
            success: false,
            message: "Login service error. Check server configuration."
        });
    }
};
