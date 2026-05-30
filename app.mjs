import express from "express";
import morgan from "morgan";
import multer from "multer";
import sqlite3 from "sqlite3";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
    createAuthMiddleware,
    hashPassword,
    sessionCookieName,
    verifyPassword,
} from "./authentication.mjs";

sqlite3.verbose();

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "public");
const app = express();
const port = process.env.PORT || 3000;
const db = new sqlite3.Database(":memory:");
const sessions = new Map();
const { attachCurrentUser, requireAuth, createSession, destroySession } = createAuthMiddleware({
    db,
    sessions,
});

const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.run(sql, params, function runCallback(error) {
            if (error) {
                reject(error);
                return;
            }

            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });

const get = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(row);
        });
    });

const all = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(rows);
        });
    });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, join(publicDir, "upload"));
    },
    filename: (req, file, cb) => {
        const safeOriginalName = file.originalname.replace(/\s+/g, "-");
        cb(null, `${Date.now()}-${safeOriginalName}`);
    },
});

const upload = multer({ storage });
const defaultPostImage = "/images/blogs.png";
const defaultAvatar = "/images/joseph.jpg";

const asyncRoute = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};

const formatDate = (value) =>
    new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));

const normalizeText = (value) => value.trim().replace(/\s+/g, " ");

const createExcerpt = (content, length = 180) => {
    const plain = normalizeText(content);
    if (plain.length <= length) {
        return plain;
    }

    return `${plain.slice(0, length).trim()}...`;
};

const avatarMarkup = (name) =>
    name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");

const initializeDatabase = async () => {
    await run("PRAGMA foreign_keys = ON");
    await run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            avatar TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            author_name TEXT NOT NULL,
            author_email TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            image TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS contact_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            topic TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const existingPosts = await get("SELECT COUNT(*) AS total FROM posts");

    if (existingPosts.total === 0) {
        const seedPosts = [
            {
                authorName: "Editorial Team",
                authorEmail: "editor@bloggers-network.local",
                title: "Building a sharper blog experience with a modern stack",
                content:
                    "A clean reading flow, better forms, and persistent data transform a static blog into a place people actually want to use. This refresh turns the old Bootstrap layout into a responsive Tailwind experience with real auth and in-memory persistence.",
                image: "/images/digitalhub.jpg",
            },
            {
                authorName: "Creative Desk",
                authorEmail: "desk@bloggers-network.local",
                title: "Why short-form content still wins on fast-moving networks",
                content:
                    "Readers respond to clarity. Tight copy, strong hero sections, and fewer dead-end screens keep a platform feeling current even before the content grows. The UI now leans into that principle with better spacing, hierarchy, and contrast.",
                image: "/images/bookhubAI.jpg",
            },
            {
                authorName: "Design Studio",
                authorEmail: "studio@bloggers-network.local",
                title: "A practical content workflow for creators who publish often",
                content:
                    "The new blog composer is intentionally simple: authenticate once, post with confidence, and let the latest entries populate the feed immediately. That makes the app feel alive rather than hard-coded.",
                image: "/images/blogs.png",
            },
        ];

        for (const post of seedPosts) {
            await run(
                `INSERT INTO posts (author_name, author_email, title, content, image)
                 VALUES (?, ?, ?, ?, ?)`,
                [post.authorName, post.authorEmail, post.title, post.content, post.image]
            );
        }
    }
};

const getStats = async () => {
    const [userTotals, postTotals, contactTotals] = await Promise.all([
        get("SELECT COUNT(*) AS total FROM users"),
        get("SELECT COUNT(*) AS total FROM posts"),
        get("SELECT COUNT(*) AS total FROM contact_messages"),
    ]);

    return {
        members: userTotals.total,
        posts: postTotals.total,
        messages: contactTotals.total,
    };
};

const fetchPosts = async (limit = 12) => {
    const rows = await all(
        `SELECT
             posts.id,
             posts.user_id,
             posts.author_name,
             posts.author_email,
             posts.title,
             posts.content,
             posts.image,
             posts.created_at,
             users.avatar AS user_avatar,
             users.name AS user_name,
             users.email AS user_email
         FROM posts
         LEFT JOIN users ON users.id = posts.user_id
         ORDER BY datetime(posts.created_at) DESC, posts.id DESC
         LIMIT ?`,
        [limit]
    );

    return rows.map((post) => {
        const creatorName = post.user_name || post.author_name;
        const creatorEmail = post.user_email || post.author_email;

        return {
            ...post,
            creatorName,
            creatorEmail,
            creatorAvatar: post.user_avatar || post.image || defaultPostImage,
            displayImage: post.image || defaultPostImage,
            excerpt: createExcerpt(post.content),
            formattedDate: formatDate(post.created_at),
            initials: avatarMarkup(creatorName),
        };
    });
};

const getPostById = async (id) => {
    const post = await get(
        `SELECT
             posts.id,
             posts.user_id,
             posts.author_name,
             posts.author_email,
             posts.title,
             posts.content,
             posts.image,
             posts.created_at,
             users.avatar AS user_avatar,
             users.name AS user_name,
             users.email AS user_email
         FROM posts
         LEFT JOIN users ON users.id = posts.user_id
         WHERE posts.id = ?`,
        [id]
    );

    if (!post) {
        return null;
    }

    const creatorName = post.user_name || post.author_name;
    const creatorEmail = post.user_email || post.author_email;

    return {
        ...post,
        creatorName,
        creatorEmail,
        creatorAvatar: post.user_avatar || post.image || defaultPostImage,
        displayImage: post.image || defaultPostImage,
        formattedDate: formatDate(post.created_at),
        initials: avatarMarkup(creatorName),
    };
};

const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
};

app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));

app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.use("/uploads", express.static(join(publicDir, "upload")));
app.use(attachCurrentUser);

const getMessageFromQuery = (queryValue) => {
    if (!queryValue) {
        return null;
    }

    return queryValue === "1" ? "Action completed successfully." : null;
};

app.get(
    "/",
    asyncRoute(async (req, res) => {
        const [stats, recentPosts] = await Promise.all([getStats(), fetchPosts(3)]);

        res.render("index.ejs", {
            pageTitle: "Home",
            stats,
            recentPosts,
            currentUser: req.user,
        });
    })
);

app.get(
    "/about",
    asyncRoute(async (req, res) => {
        const stats = await getStats();

        res.render("about.ejs", {
            pageTitle: "About",
            stats,
            currentUser: req.user,
        });
    })
);

app.get(
    "/contact",
    asyncRoute(async (req, res) => {
        res.render("contact.ejs", {
            pageTitle: "Contact",
            successMessage: getMessageFromQuery(req.query.sent),
            currentUser: req.user,
        });
    })
);

app.post(
    "/contact",
    asyncRoute(async (req, res) => {
        const name = normalizeText(req.body.name || "");
        const email = normalizeText(req.body.email || "");
        const topic = normalizeText(req.body.topic || "General question");
        const message = normalizeText(req.body.message || "");

        if (!name || !email || !message) {
            return res.status(400).render("contact.ejs", {
                pageTitle: "Contact",
                errorMessage: "Please fill out your name, email, and message.",
                currentUser: req.user,
            });
        }

        await run(
            `INSERT INTO contact_messages (name, email, topic, message)
             VALUES (?, ?, ?, ?)`,
            [name, email, topic, message]
        );

        return res.redirect("/contact?sent=1");
    })
);

app.get(
    "/login",
    asyncRoute(async (req, res) => {
        res.render("login.ejs", {
            pageTitle: "Login",
            nextUrl: req.query.next || "/blog",
            currentUser: req.user,
        });
    })
);

app.post(
    "/login",
    asyncRoute(async (req, res) => {
        const email = normalizeText(req.body.email || "").toLowerCase();
        const password = req.body.password || "";
        const nextUrl = req.body.next || "/blog";

        const user = await get(
            `SELECT id, name, email, password_hash, avatar, created_at
             FROM users
             WHERE lower(email) = lower(?)`,
            [email]
        );

        if (!user || !verifyPassword(password, user.password_hash)) {
            return res.status(401).render("login.ejs", {
                pageTitle: "Login",
                nextUrl,
                errorMessage: "Incorrect email or password.",
                currentUser: req.user,
            });
        }

        const sessionToken = createSession(user.id);
        res.cookie(sessionCookieName, sessionToken, cookieOptions);

        return res.redirect(nextUrl || "/blog");
    })
);

app.get(
    "/register",
    asyncRoute(async (req, res) => {
        res.render("register.ejs", {
            pageTitle: "Register",
            nextUrl: req.query.next || "/blog",
            currentUser: req.user,
        });
    })
);

app.post(
    "/register",
    upload.single("photo"),
    asyncRoute(async (req, res) => {
        const name = normalizeText(req.body.name || "");
        const email = normalizeText(req.body.email || "").toLowerCase();
        const password = req.body.password || "";
        const nextUrl = req.body.next || "/blog";
        const avatarFile = req.file ? `/uploads/${req.file.filename}` : defaultAvatar;

        if (!name || !email || !password) {
            return res.status(400).render("register.ejs", {
                pageTitle: "Register",
                nextUrl,
                errorMessage: "All fields are required before you can create an account.",
                currentUser: req.user,
            });
        }

        const existingUser = await get("SELECT id FROM users WHERE lower(email) = lower(?)", [email]);

        if (existingUser) {
            return res.status(409).render("register.ejs", {
                pageTitle: "Register",
                nextUrl,
                errorMessage: "That email is already registered. Try logging in instead.",
                currentUser: req.user,
            });
        }

        const passwordHash = hashPassword(password);
        const result = await run(
            `INSERT INTO users (name, email, password_hash, avatar)
             VALUES (?, ?, ?, ?)`,
            [name, email, passwordHash, avatarFile]
        );

        const sessionToken = createSession(result.lastID);
        res.cookie(sessionCookieName, sessionToken, cookieOptions);

        return res.redirect(nextUrl || "/blog");
    })
);

app.get(
    "/logout",
    asyncRoute(async (req, res) => {
        destroySession(req, res);
        return res.redirect("/");
    })
);

app.get(
    "/blog",
    asyncRoute(async (req, res) => {
        const posts = await fetchPosts(24);
        const stats = await getStats();

        res.render("blog.ejs", {
            pageTitle: "Blog",
            posts,
            stats,
            successMessage: getMessageFromQuery(req.query.posted),
            currentUser: req.user,
        });
    })
);

const handlePostCreation = asyncRoute(async (req, res) => {
    const title = normalizeText(req.body.title || "");
    const content = normalizeText(req.body.blog || req.body.content || "");
    const imageFile = req.file ? `/uploads/${req.file.filename}` : defaultPostImage;

    if (!title || !content) {
        const posts = await fetchPosts(24);
        return res.status(400).render("blog.ejs", {
            pageTitle: "Blog",
            posts,
            stats: await getStats(),
            currentUser: req.user,
            errorMessage: "Title and content are required to publish a post.",
        });
    }

    await run(
        `INSERT INTO posts (user_id, author_name, author_email, title, content, image)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, req.user.name, req.user.email, title, content, imageFile]
    );

    return res.redirect("/blog?posted=1");
});

app.post("/blog/posts", requireAuth, upload.single("postImage"), handlePostCreation);
app.post("/blog", requireAuth, upload.single("postImage"), handlePostCreation);
app.post("/blogger", requireAuth, upload.single("blogger_image"), handlePostCreation);

app.get(
    "/blog/:id",
    asyncRoute(async (req, res) => {
        const post = await getPostById(Number(req.params.id));

        if (!post) {
            return res.status(404).render("blog.ejs", {
                pageTitle: "Blog",
                posts: await fetchPosts(24),
                stats: await getStats(),
                errorMessage: "The post you requested could not be found.",
                currentUser: req.user,
            });
        }

        res.render("blog.ejs", {
            pageTitle: post.title,
            posts: [post],
            featuredPost: post,
            stats: await getStats(),
            currentUser: req.user,
        });
    })
);

app.use((error, req, res, next) => {
    console.error(error);

    if (res.headersSent) {
        return next(error);
    }

    return res.status(500).render("contact.ejs", {
        pageTitle: "Contact",
        errorMessage: "Something went wrong. Please try again.",
        currentUser: req.user,
    });
});

await initializeDatabase();

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
