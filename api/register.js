
const bcrypt = require("bcryptjs");

const {
    db,
    initializeDatabase,
    createSession,
    setSessionCookie
} = require("./_lib");

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed."
        });
    }

    try {
        await initializeDatabase();

        const {
            username,
            email,
            password,
            category,
            profileImage
        } = req.body || {};

        if (!username || !email || !password || !category || !profileImage) {
            return res.status(400).json({
                success: false,
                message: "Please complete all registration fields."
            });
        }

        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanUsername.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Username must contain at least 3 characters."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if (!["Agriculture", "Driving Laws"].includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Invalid learning category."
            });
        }

        if (
            typeof profileImage !== "string" ||
            !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(profileImage) ||
            profileImage.length > 2 * 1024 * 1024
        ) {
            return res.status(400).json({
                success: false,
                message: "Choose a supported image smaller than 1.5 MB."
            });
        }

        const existing = await db.execute({
            sql: "SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?",
            args: [cleanEmail, cleanUsername.toLowerCase()]
        });

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Username or email is already registered."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await db.execute({
            sql: `
                INSERT INTO users
                (username, email, password_hash, category, profile_image, role)
                VALUES (?, ?, ?, ?, ?, 'student')
            `,
            args: [
                cleanUsername,
                cleanEmail,
                passwordHash,
                category,
                profileImage
            ]
        });

        const user = {
            id: Number(result.lastInsertRowid),
            username: cleanUsername,
            email: cleanEmail,
            role: "student"
        };

        const token = createSession(user);
        setSessionCookie(res, token);

        return res.status(201).json({
            success: true,
            role: "student",
            message: "Account created successfully."
        });

    } catch (error) {
        console.error("MENYA REGISTER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Registration failed. Please try again."
        });
    }
};
