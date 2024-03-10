import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import session from "express-session";
import env from "dotenv";
import cors from "cors";

const app = express();
app.use(express.json())
app.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
const port = 3001;
const saltRounds = 10;
env.config();

app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        expires: 24 * 60 * 60 * 1000,
      }  
    })
);

// Middleware
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

// Database configuration
const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});
db.connect();


app.get("/Login", (req, res) => {
  if (req.session.user) {
    res.send({ loggedIn: true, user: req.session.user });
  } else {
    res.send({ loggedIn: false });
  }
});

// Routes
app.post("/Login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
      email,
    ]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const storedHashedPassword = user.password;
      bcrypt.compare(password, storedHashedPassword, (err, response) => {
        if (response) {
          req.session.user = result;
          console.log(req.session.user);
          res.send(result);
        } else {
          res.send({ message: "Wrong username/password combination!" });
        }
      });
    } else {
      res.send({ message: "User doesn't exist" });
    }
  } catch (err) {
    console.log(err);
    return cb(err);
  }
});

app.post("/SignUp", async (req, res) => {
  const username=req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }
  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    
    if (checkResult.rows.length > 0) {
      console.log("User already exists. Redirecting to login...");
      res.send({status:true});
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *",
            [username, email, hash]
            );
            const user = result.rows[0];
            req.login(user, (err) => {
              if (err) {
                console.error("Error logging in:", err);
              } else {
                console.log("Success");
                res.send({status:true});
              }
            });
          }
        });
      }
    } catch (err) {
      console.log(err);
    }
  });

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
