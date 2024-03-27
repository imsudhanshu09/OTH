import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import pg from "pg";
import bcrypt from "bcrypt";
//import passport from "passport";
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
      saveUninitialized: true,
      cookie: {
        maxAge: 72 * 60 * 60 * 1000, // 72 hrs
        httpOnly: false,
        // secure: true, // Enable this if using HTTPS
        // sameSite: "strict",
      }  
    })
);

// Middleware
app.use(bodyParser.json());
app.use(express.static("public"));

// app.use(passport.initialize());
// app.use(passport.session());

// Database configuration
const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});
db.connect();

// Middleware function to initialize user progress in session
const initializeUserProgress = (req, res, next) => {
  if (!req.session.userProgress) {
    req.session.userProgress = {};
  }
  
  const userId = req.session.userId;

  if (!userId) {
    // New user, initialize progress starting from question 1
    req.session.userProgress = { 1: true }; // Assuming question 1 has ID 1
  } else {
    // Returning user, retrieve progress from session
    if (!req.session.userProgress[userId]) {
      req.session.userProgress[userId] = {};
    }
  }
  
  next();
};

app.use(initializeUserProgress);

const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).send({ error: "Unauthorized" });
  }
  next();
};

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

      const match = await bcrypt.compare(password, storedHashedPassword);
        if (match) {
          req.session.userProgress[user.id] = req.session.userProgress[user.id] || {};
          req.session.user = user;
          req.session.userId = user.user_id;
          console.log("userId assigned to session:", req.session.userId);     
          res.send({status:true, userId: user.id});
        } else {
          console.log("this is error",err);
          res.send({status:false});
          res.send({ message: "Wrong username/password combination!" });
        }
    } else {
      res.send({ message: "User doesn't exist" });
    }
  } catch (err) {
    console.log(err);
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
            `INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *`,
            [username, email, hash]
            );
            const user = result.rows[0];          
            if (err) {
              console.error("Error logging in:", err);
            } else {
              console.log("Success");
              res.send({status:true});
            }
          }
        });
      }
    } catch (err) {
      console.log(err);
    }
});

// Middleware function to check if user is logged in
// const requireLogin = (req, res, next) => {
//   if (!req.session.userId) {
//     return res.status(401).send({ error: "Unauthorized" });
//   }
//   next();
// };

// Define route to fetch questions
app.get("/questions", requireLogin, async (req, res) => {
  try {
    // Retrieve user's ID from the session
    const userId = req.session.userId;

    // Retrieve user's progress from the session
    const userProgress = req.session.userProgress[userId] || {};

    // Retrieve the last answered question ID from the users table
    const lastAnsweredQuestionResult = await db.query(
      "SELECT last_answered_question_id FROM users WHERE user_id = $1",
      [userId]
    );
    const lastAnsweredQuestionId = lastAnsweredQuestionResult.rows[0]?.last_answered_question_id;

    // Find the next unanswered question ID, starting from the last answered question
    let nextQuestionId;
    if (lastAnsweredQuestionId !== null && lastAnsweredQuestionId !== undefined) {
      const nextQuestionResult = await db.query(
        "SELECT id FROM questions WHERE id > $1 AND id NOT IN (SELECT last_answered_question_id FROM users WHERE user_id = $2) ORDER BY id LIMIT 1",
        [lastAnsweredQuestionId, userId]
      );
      if (nextQuestionResult.rows.length > 0) {
        nextQuestionId = nextQuestionResult.rows[0].id;
      }
    } else {
      // If no last answered question ID is found, start from the first question
      const firstQuestionResult = await db.query(
        "SELECT id FROM questions ORDER BY id LIMIT 1"
      );
      if (firstQuestionResult.rows.length > 0) {
        nextQuestionId = firstQuestionResult.rows[0].id;
      }
    }

    if (!nextQuestionId) {
      // If there's no next unanswered question, return an appropriate response
      return res.json({ message: "Congratulations! You have answered all the questions." });
    }

    // Retrieve the details of the next question from the database
    const nextQuestionResult = await db.query(
      "SELECT id, question_text, image_url, correct_answer FROM questions WHERE id = $1",
      [nextQuestionId]
    );
    const nextQuestion = nextQuestionResult.rows[0];

    // Send the details of the next question
    res.json(nextQuestion);
  } catch (err) {
    console.error("Error fetching next question:", err);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Add this function to update the last_correct_answer_timestamp in the users table
const updateLastCorrectAnswerTimestamp = async (userId, answer) => {
  try {
    // Fetch the user's last answered question ID
    const queryResult = await db.query(
      "SELECT last_answered_question_id FROM users WHERE user_id = $1",
      [userId]
    );
    const lastAnsweredQuestionId = queryResult.rows[0].last_answered_question_id;

    // Fetch the correct answer for the last answered question
    const correctAnswerResult = await db.query(
      "SELECT correct_answer FROM questions WHERE id = $1",
      [lastAnsweredQuestionId]
    );
    const correctAnswer = correctAnswerResult.rows[0].correct_answer;

    // Update the last_correct_answer_timestamp if the user's answer was correct
    if (answer === correctAnswer) {
      await db.query(
        "UPDATE users SET last_correct_answer_timestamp = CURRENT_TIMESTAMP WHERE user_id = $1",
        [userId]
      );
    }
  } catch (error) {
    console.error("Error updating last_correct_answer_timestamp:", error);
    // Handle the error
  }
};


// Modify the route for handling answer submission to call the function for updating timestamp
app.post("/questions/:questionId/answer", async (req, res) => {
  const { questionId } = req.params;
  const userId = req.session.userId;

  try {
    const result = await db.query(
      "SELECT correct_answer FROM questions WHERE id = $1",
      [questionId]
    );
    const correctAnswer = result.rows[0].correct_answer;

    if (req.body.answer === correctAnswer) {
      // Update user progress and timestamp
      req.session.userProgress[questionId] = true;
      await db.query(
        "UPDATE users SET last_answered_question_id = $1 WHERE user_id = $2",
        [questionId, userId]
      );
      // Call function to update timestamp
      await updateLastCorrectAnswerTimestamp(userId, req.body.answer);

      res.json({ correct: true });
    } else {
      res.json({ correct: false });
    }
  } catch (error) {
    console.error("Error handling answer:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});


// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});