const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let sessions = {};

function generateSessionId() {
  return Math.random().toString(36).substring(2, 7);
}

io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("join_session", ({ sessionId, voterId }) => {
    console.log("Join request:", sessionId, voterId);

    if (!sessions[sessionId]) {
      socket.emit("join_error", "Session not found");
      return;
    }

    socket.join(sessionId);

    const alreadyVoted = sessions[sessionId].voters.includes(voterId);

    socket.emit("session_data", {
      sessionId,
      question: sessions[sessionId].question,
      options: sessions[sessionId].options,
      type: sessions[sessionId].type,
      answers: sessions[sessionId].answers,
      alreadyVoted
    });
  });

  socket.on("submit_answer", ({ sessionId, answer, voterId }) => {
    console.log("Vote request:", sessionId, answer, voterId);

    if (!sessions[sessionId]) {
      socket.emit("vote_error", "Session not found");
      return;
    }

    if (!sessions[sessionId].options.includes(answer)) {
      socket.emit("vote_error", "Invalid answer");
      return;
    }

    if (sessions[sessionId].voters.includes(voterId)) {
      socket.emit("vote_error", "You have already voted in this session");
      return;
    }

    sessions[sessionId].answers.push(answer);
    sessions[sessionId].voters.push(voterId);

    socket.emit("vote_success", "Your vote has been submitted");
    io.to(sessionId).emit("update_results", sessions[sessionId].answers);
  });
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.post("/create-session", (req, res) => {
  try {
    const { question, options, type } = req.body;

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: "Invalid question data" });
    }

    const sessionId = generateSessionId();

    sessions[sessionId] = {
      question,
      options,
      type: type || "multiple",
      answers: [],
      voters: []
    };

    console.log("Created session:", sessionId, sessions[sessionId]);

    res.json({
      sessionId,
      question: sessions[sessionId].question,
      options: sessions[sessionId].options,
      type: sessions[sessionId].type
    });
  } catch (error) {
    console.error("Create session error:", error);
    res.status(500).json({ error: "Server error while creating session" });
  }
});

app.get("/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  if (!sessions[sessionId]) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.json({
    sessionId,
    question: sessions[sessionId].question,
    options: sessions[sessionId].options,
    type: sessions[sessionId].type,
    answers: sessions[sessionId].answers
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});