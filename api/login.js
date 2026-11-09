
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const {
    db,
    initializeDatabase,
    createSession,
    setSessionCookie
} = require("../lib/menya");

function send(res, status, data) {
    return res.status(status).json(data);
}

function safeEqual(a, b) {
    const first = Buffer.from(String(a));
    const second = Buffer.from(String(b));

    return first.length === second.length &&
        crypto.timingSafeEqual(first, second);
}

module.exports = async function handler(req, res) {

    // ONLY POST REQUESTS

    if (req.method !== "POST") {
        return send(res, 405, {
            success: false,
            message: "Method not allowed.",
            error: "Use POST method."
        });
    }

    try {

        // CHECK ENVIRONMENT VARIABLES

        const requiredVariables = [
            "TURSO_DATABASE_URL",
            "TURSO_AUTH_TOKEN",
            "SESSION_SECRET",
            "ADMIN_EMAIL",
            "ADMIN_PASSWORD"
        ];

        const missing = requiredVariables.filter(
            name => !process.env[name]
        );

        if (missing.length > 0) {
            throw new Error(
                "Missing Vercel environment variables: " +
                missing.join(", ")
            );
        }

        // INITIALIZE DATABASE

        await initializeDatabase();

        // GET LOGIN INFORMATION

        const { identity, password } = req.body || {};

        if (
            typeof identity !== "string" ||
            typeof password !== "string" ||
            !identity.trim() ||
            !password
        ) {
            return send(res, 400, {
                success: false,
                message: "Please enter your username/email and password.",
                error: "INVALID_LOGIN_INPUT"
            });
        }

        const cleanIdentity = identity.trim();
        const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();

        // =================================
        // ADMIN LOGIN
        // =================================

        if (
            cleanIdentity.toLowerCase() === adminEmail &&
            safeEqual(password, process.env.ADMIN_PASSWORD)
        ) {

            const adminHash = await bcrypt.hash(
                process.env.ADMIN_PASSWORD,
                12
            );

            // CREATE OR UPDATE ADMIN ACCOUNT

            await db.execute({
                sql: `
                    INSERT INTO users
                    (username, email, password_hash, category, role)
                    VALUES (?, ?, ?, 'Administration', 'admin')

                    ON CONFLICT(email) DO UPDATE SET
                    password_hash = excluded.password_hash,
                    role = 'admin'
                `,
                args: [
                    "MENYA Administrator",
                    adminEmail,
                    adminHash
                ]
            });

            // GET ADMIN ACCOUNT

            const adminResult = await db.execute({
                sql: `
                    SELECT id, username, email, role
                    FROM users
                    WHERE email = ?
                `,
                args: [adminEmail]
            });

            if (adminResult.rows.length === 0) {
                throw new Error("ADMIN_ACCOUNT_CREATION_FAILED");
            }

            const admin = adminResult.rows[0];

            // CREATE SESSION

            const token = createSession(admin);

            setSessionCookie(res, token);

            return send(res, 200, {
                success: true,
                role: "admin",
                message: "Admin login successful."
            });
        }

        // =================================
        // STUDENT LOGIN
        // =================================

        const result = await db.execute({
            sql: `
                SELECT
                    id,
                    username,
                    email,
                    password_hash,
                    role
                FROM users
                WHERE LOWER(username) = LOWER(?)
                   OR LOWER(email) = LOWER(?)
                LIMIT 1
            `,
            args: [
                cleanIdentity,
                cleanIdentity
            ]
        });

        if (result.rows.length === 0) {
            return send(res, 401, {
                success: false,
                message: "Account not found. Check your username or email.",
                error: "ACCOUNT_NOT_FOUND"
            });
        }

        const student = result.rows[0];

        // VERIFY PASSWORD

        const validPassword = await bcrypt.compare(
            password,
            student.password_hash
        );

        if (!validPassword) {
            return send(res, 401, {
                success: false,
                message: "Incorrect password. Please try again.",
                error: "INVALID_PASSWORD"
            });
        }

        // STUDENT ROLE CHECK

        if (student.role !== "student") {
            return send(res, 403, {
                success: false,
                message: "This account does not have student access.",
                error: "INVALID_STUDENT_ROLE"
            });
        }

        // CREATE STUDENT SESSION

        const token = createSession(student);

        setSessionCookie(res, token);

        return send(res, 200, {
            success: true,
            role: "student",
            message: "Student login successful."
        });

    } catch (error) {

        // DEBUGGING INFORMATION

        console.error("========== MENYA LOGIN ERROR ==========");
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Error stack:", error.stack);
        console.error("========================================");

        return send(res, 500, {
            success: false,
            message: "MENYA LOGIN BACKEND ERROR",
            error: error.message || "Unknown server error",
            errorName: error.name || "UnknownError",
            errorCode: error.code || null
        });
    }
};
