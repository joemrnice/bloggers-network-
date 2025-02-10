import express from "express";
import bodyParser from "body-parser";
import morgan from "morgan";
import userAccessGranted from "./authentication.mjs";
import { dirname } from "path";
import { fileURLToPath } from "url";

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

app.post('/blogger', (req, res) => {
    let photos = req.body["src"];
    const photo = `<img src="images/${photos}" alt="blogger">`;
    let blogger = req.body["name"];
    let title = req.body["title"];
    let content = req.body["blog"];
    res.render("blog.ejs", {
        image: photo,
        blogs: blogger,
        blogTitle: title,
        blogPost:content
    });
});

app.listen(port, (err) => {
    if (err) throw err;
    console.log(`Server listening on port ${port}`);
});
