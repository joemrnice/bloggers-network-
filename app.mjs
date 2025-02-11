import express from "express";
import bodyParser from "body-parser";
import morgan from "morgan";
import userAccessGranted from "./authentication.mjs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import multer from "multer";

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    },
});

// Initialize Multer with the storage configuration

const upload = multer({ storage });


const _dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(userAccessGranted);

app.get('/', (req, res) => {
    res.render("index.ejs");
});

app.get('/about', (req, res) => {
    res.render("about.ejs");
});

app.get('/contact', (req, res) => {
    res.render("contact.ejs");
});

app.get('/login', (req, res) => {
    res.render("login.ejs");
});


app.get('/blog', (req, res) => {
    res.render("blog.ejs");
});

app.get('/register', (req, res) => {
    res.render("register.ejs");
});

app.post('/register', (req, res) => {
    userAccessGranted ? res.sendFile(_dirname + "/public/pages/index.html")
        : res.render('register.ejs');
});

app.post('/blogger', upload.single('blogger_image'), (req, res) => {
    let blogger_image = req.file ? req.file.filename : null;
    let blogger = req.body["name"];
    let title = req.body["title"];
    let content = req.body["blog"];
    let dateCreated = new Date().getFullYear();
    res.render("blog.ejs", {
        image: blogger_image,
        blogs: blogger,
        blogTitle: title,
        blogPost: content,
        created_at: dateCreated
    });
});

app.listen(port, (err) => {
    if (err) throw err;
    console.log(`Server running on http://localhost:${port}`);
});
