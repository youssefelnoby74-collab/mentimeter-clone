import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import QRCode from "react-qr-code";

const BACKEND_URL = "https://mentimeter-backend-h4zt.onrender.com";
const socket = io(BACKEND_URL);

const theme = {
  primary: "#4f46e5",
  secondary: "#06b6d4",
  background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
  card: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  light: "#f8fafc"
};

function getVoterId() {
  let voterId = localStorage.getItem("voterId");
  if (!voterId) {
    voterId = "voter_" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem("voterId", voterId);
  }
  return voterId;
}

function App() {
  const [page, setPage] = useState("home");

  const [questionType, setQuestionType] = useState("multiple");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [questionsList, setQuestionsList] = useState([]);
  const [sessionId, setSessionId] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [joinedQuestions, setJoinedQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [results, setResults] = useState([]);

  const [message, setMessage] = useState("");

  const voterId = getVoterId();
  const frontendUrl = window.location.origin;

  const qrLink = sessionId ? `${frontendUrl}?code=${sessionId}` : "";

  // ---------- CREATE ----------
  const getFinalOptions = () => {
    if (questionType === "truefalse") return ["True", "False"];
    if (questionType === "wordcloud") return [];
    return options.filter((o) => o.trim() !== "");
  };

  const addQuestion = () => {
    const finalOptions = getFinalOptions();

    if (!question.trim()) {
      setMessage("Write question first");
      return;
    }

    if (questionType !== "wordcloud" && finalOptions.length < 2) {
      setMessage("Need at least 2 options");
      return;
    }

    setQuestionsList([
      ...questionsList,
      {
        question,
        options: finalOptions,
        type: questionType
      }
    ]);

    setQuestion("");
    setOptions(["", "", "", ""]);
    setMessage("Added ✅");
  };

  const createSession = async () => {
    if (questionsList.length === 0) {
      setMessage("Add at least one question");
      return;
    }

    const res = await fetch(`${BACKEND_URL}/create-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: questionsList })
    });

    const data = await res.json();
    setSessionId(data.sessionId);
  };

  // ---------- JOIN ----------
  const joinSession = () => {
    socket.emit("join_session", {
      sessionId: joinCode,
      voterId
    });
  };

  const submitAll = () => {
    const answers = joinedQuestions.map((q) => ({
      questionId: q.id,
      answer: selectedAnswers[q.id]
    }));

    socket.emit("submit_answers", {
      sessionId: joinCode,
      answers,
      voterId
    });
  };

  // ---------- SOCKET ----------
  useEffect(() => {
    socket.on("session_data", (data) => {
      setJoined(true);
      setJoinedQuestions(data.questions);
      setResults(data.results);
    });

    socket.on("update_results", (data) => {
      setResults(data);
    });

    socket.on("vote_success", (msg) => {
      setMessage(msg);
    });

    socket.on("vote_error", (msg) => {
      setMessage(msg);
    });

    return () => {
      socket.off("session_data");
      socket.off("update_results");
      socket.off("vote_success");
      socket.off("vote_error");
    };
  }, []);

  // ---------- UI ----------
  const grid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "15px"
  };

  const box = {
    background: theme.light,
    padding: "15px",
    borderRadius: "12px",
    border: "1px solid #ddd"
  };

  return (
    <div style={{ padding: "30px", fontFamily: "sans-serif" }}>
      {page === "home" && (
        <>
          <h1>Mentimeter Clone</h1>
          <button onClick={() => setPage("create")}>Create</button>
          <button onClick={() => setPage("join")}>Join</button>
        </>
      )}

      {page === "create" && (
        <>
          <h2>Create</h2>

          <select
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value)}
          >
            <option value="multiple">Multiple</option>
            <option value="truefalse">True / False</option>
            <option value="wordcloud">Word Cloud</option>
          </select>

          <input
            placeholder="Question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />

          {questionType === "multiple" &&
            options.map((o, i) => (
              <input
                key={i}
                placeholder={`Option ${i + 1}`}
                value={o}
                onChange={(e) => {
                  const arr = [...options];
                  arr[i] = e.target.value;
                  setOptions(arr);
                }}
              />
            ))}

          {questionType === "wordcloud" && (
            <p>Users will type their answer</p>
          )}

          <button onClick={addQuestion}>Add Question</button>

          <button onClick={createSession}>Create Session</button>

          <h3>Questions</h3>
          <div style={grid}>
            {questionsList.map((q, i) => (
              <div key={i} style={box}>
                {q.question}
              </div>
            ))}
          </div>

          {sessionId && (
            <>
              <h2>Code: {sessionId}</h2>
              <QRCode value={qrLink} />
            </>
          )}
        </>
      )}

      {page === "join" && (
        <>
          <h2>Join</h2>
          <input
            placeholder="code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button onClick={joinSession}>Join</button>

          {joined && (
            <>
              <div style={{ ...grid, marginTop: "20px" }}>
                {joinedQuestions.map((q) => (
                  <div key={q.id} style={box}>
                    <h3>{q.question}</h3>

                    {/* MULTIPLE */}
                    {q.type !== "wordcloud" &&
                      q.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() =>
                            setSelectedAnswers({
                              ...selectedAnswers,
                              [q.id]: opt
                            })
                          }
                        >
                          {opt}
                        </button>
                      ))}

                    {/* WORD CLOUD */}
                    {q.type === "wordcloud" && (
                      <input
                        placeholder="Type answer..."
                        onChange={(e) =>
                          setSelectedAnswers({
                            ...selectedAnswers,
                            [q.id]: e.target.value
                          })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>

              <button onClick={submitAll}>Submit</button>

              <h2>Results</h2>
              <div style={grid}>
                {results.map((r) => (
                  <div key={r.id} style={box}>
                    <h4>{r.question}</h4>

                    {/* NORMAL */}
                    {r.type !== "wordcloud" &&
                      r.options.map((o) => (
                        <div key={o}>
                          {o} — {r.counts[o] || 0}
                        </div>
                      ))}

                    {/* WORD CLOUD */}
                    {r.type === "wordcloud" &&
                      r.wordCounts.map((w) => (
                        <div key={w.text}>
                          {w.text} {w.count > 1 ? `— ${w.count}` : ""}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {message && <p>{message}</p>}
    </div>
  );
}

export default App;