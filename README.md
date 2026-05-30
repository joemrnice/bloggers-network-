# Bloggers Network

Bloggers Network is a refreshed creator hub with real authentication, an in-memory SQLite data layer, and a Tailwind CDN interface. Users can register with an email and password, log in, publish blog posts, browse the feed, and send contact messages without the old static-page workflow.

## What changed

- Real auth backed by SQLite user records and salted password hashes.
- Blog posts are stored in an in-memory SQLite table and rendered dynamically.
- The UI was rebuilt with Tailwind CDN for a more modern, responsive layout.
- Contact submissions are now persisted instead of being ignored.

## Project structure

```text
views/
  partials/
    head.ejs
    header.ejs
    footer.ejs
  index.ejs
  about.ejs
  contact.ejs
  login.ejs
  register.ejs
  blog.ejs
public/
  images/
  upload/
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm start
   ```

3. Open the site at `http://localhost:3000`.

## Notes

- The database lives in memory, so data resets when the server restarts.
- The blog feed is seeded with starter posts so the UI is useful on first run.
- Uploaded images are served from `public/upload`.

## Key routes

- `/` home
- `/about` story and platform overview
- `/contact` contact form and submission storage
- `/register` account creation
- `/login` sign-in
- `/blog` post feed and composer

## License

MIT
