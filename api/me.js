
const {
    db,
    initializeDatabase,
    getSession
} = require("./_lib");

module.exports = async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed."
        });
    }

    try {
        await initializeDatabase();

        const session = getSession(req);

        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const result = await db.execute({
            sql: `
                SELECT id, username, email, category, profile_image, role
                FROM users
                WHERE id = ?
            `,
            args: [session.id]
        });

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Account not found."
            });
        }

        const user = result.rows[0];

        if (user.role !== session.role) {
            return res.status(403).json({
                success: false,
                message: "Access denied."
            });
        }

        return res.status(200).json({
            success: true,
            user
        });

    } catch (error) {
        console.error("MENYA SESSION ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify session."
        });
    }
};
