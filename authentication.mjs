import crypto from "crypto";

export const sessionCookieName = "bloggers_session";

export function parseCookies(cookieHeader = "") {
    return cookieHeader.split(";").reduce((cookies, cookiePart) => {
        const [rawName, ...rawValue] = cookiePart.trim().split("=");

        if (!rawName) {
            return cookies;
        }

        cookies[rawName] = decodeURIComponent(rawValue.join("="));
        return cookies;
    }, {});
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(":")) {
        return false;
    }

    const [salt, expectedHash] = storedHash.split(":");
    const computedHash = crypto.scryptSync(password, salt, 64).toString("hex");

    return crypto.timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(expectedHash, "hex"));
}

export function createAuthMiddleware({ db, sessions }) {
    const attachCurrentUser = (req, res, next) => {
        const cookies = parseCookies(req.headers.cookie || "");
        const sessionToken = cookies[sessionCookieName];

        if (!sessionToken || !sessions.has(sessionToken)) {
            req.user = null;
            res.locals.currentUser = null;
            return next();
        }

        const session = sessions.get(sessionToken);

        db.get(
            `SELECT id, name, email, avatar, created_at
             FROM users
             WHERE id = ?`,
            [session.userId],
            (error, user) => {
                if (error || !user) {
                    sessions.delete(sessionToken);
                    req.user = null;
                    res.locals.currentUser = null;
                    return next();
                }

                req.user = user;
                res.locals.currentUser = user;
                next();
            }
        );
    };

    const requireAuth = (req, res, next) => {
        if (req.user) {
            return next();
        }

        const redirectTarget = encodeURIComponent(req.originalUrl || "/blog");
        return res.redirect(`/login?next=${redirectTarget}`);
    };

    const createSession = (userId) => {
        const sessionToken = crypto.randomBytes(24).toString("hex");
        sessions.set(sessionToken, {
            userId,
            createdAt: Date.now(),
        });

        return sessionToken;
    };

    const destroySession = (req, res) => {
        const cookies = parseCookies(req.headers.cookie || "");
        const sessionToken = cookies[sessionCookieName];

        if (sessionToken) {
            sessions.delete(sessionToken);
        }

        res.clearCookie(sessionCookieName);
    };

    return {
        attachCurrentUser,
        requireAuth,
        createSession,
        destroySession,
    };
}
