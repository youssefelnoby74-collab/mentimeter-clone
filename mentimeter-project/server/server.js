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

function normalizeTextAnswer(answer) {
  return answer.trim().toLowerCase();
}

function buildResults(questions) {
  return questions.map((question) => {
    if (question.type === "wordcloud") {
      const counts = {};

      question.answers.forEach((answer) => {
        const normalized = normalizeTextAnswer(answer);

        if (!counts[normalized]) {
          counts[normalized] = {
            text: answer.trim(),
            count: 0
          };
        }

        counts[normalized].count += 1;
      });

      return {
        id: question.id,
        question: question.question,
        type: question.type,
        options: [],
        answers: question.answers,
        wordCounts: Object.values(counts)
      };
    }

    const counts = {};

    question.answers.forEach((answer) => {
      counts[answer] = (counts[answer] || 0) + 1;
    });

    return {
      id: question.id,
      question: question.question,
      type: question.type,
      options: question.options,
      answers: question.answers,
      counts
    };
  });
}

io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("join_session", ({ sessionId, voterId }) => {
    if (!sessions[sessionId]) {
      socket.emit("join_error", "Session not found");
      return;
    }

    socket.join(sessionId);

    const session = sessions[sessionId];
    const alreadyVoted = session.voters.includes(voterId);

    socket.emit("session_data", {
      sessionId,
      questions: session.questions,
      results: buildResults(session.questions),
      alreadyVoted
    });
  });

  socket.on("submit_answers", ({ sessionId, answers, voterId }) => {
    if (!sessions[sessionId]) {
      socket.emit("vote_error", "Session not found");
      return;
    }

    const session = sessions[sessionId];

    if (session.voters.includes(voterId)) {
      socket.emit("vote_error", "You have already voted in this session");
      return;
    }

    if (!answers || !Array.isArray(answers)) {
      socket.emit("vote_error", "Invalid answers");
      return;
    }

    for (const submittedAnswer of answers) {
      const question = session.questions.find(
        (q) => q.id === submittedAnswer.questionId
      );

      if (!question) {
        socket.emit("vote_error", "Invalid question");
        return;
      }

      if (!submittedAnswer.answer || !String(submittedAnswer.answer).trim()) {
        socket.emit("vote_error", "Please answer all questions");
        return;
      }

      if (question.type !== "wordcloud") {
        if (!question.options.includes(submittedAnswer.answer)) {
          socket.emit("vote_error", "Invalid answer");
          return;
        }
      }
    }

    answers.forEach((submittedAnswer) => {
      const question = session.questions.find(
        (q) => q.id === submittedAnswer.questionId
      );

      question.answers.push(String(submittedAnswer.answer).trim());
    });

    session.voters.push(voterId);

    socket.emit("vote_success", "Your answers have been submitted");
    io.to(sessionId).emit("update_results", buildResults(session.questions));
  });
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.post("/create-session", (req, res) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "No questions provided" });
    }

    const finalQuestions = questions.map((q, index) => {
      const type = q.type || "multiple";

      return {
        id: index + 1,
        question: q.question,
        type,
        options: type === "wordcloud" ? [] : q.options,
        answers: []
      };
    });

    for (const q of finalQuestions) {
      if (!q.question || !q.question.trim()) {
        return res.status(400).json({ error: "Invalid question text" });
      }

      if (q.type !== "wordcloud") {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          return res.status(400).json({ error: "Invalid question options" });
        }
      }
    }

    const sessionId = generateSessionId();

    sessions[sessionId] = {
      questions: finalQuestions,
      voters: []
    };

    console.log("Created session:", sessionId, sessions[sessionId]);

    res.json({
      sessionId,
      questions: sessions[sessionId].questions
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

  const session = sessions[sessionId];

  res.json({
    sessionId,
    questions: session.questions,
    results: buildResults(session.questions)
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});