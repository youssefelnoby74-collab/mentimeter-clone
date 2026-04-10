import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import QRCode from "react-qr-code";

const FRONTEND_URL = "https://mentimeter-frontend-new.vercel.app";
const BACKEND_URL = "https://mentimeter-backend-h4zt.onrender.com";

const socket = io(BACKEND_URL);

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
  const [option1, setOption1] = useState("");
  const [option2, setOption2] = useState("");
  const [sessionId, setSessionId] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [joinedQuestion, setJoinedQuestion] = useState("");
  const [joinedOptions, setJoinedOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const voterId = getVoterId();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code");

    if (codeFromUrl) {
      setPage("join");
      setJoinCode(codeFromUrl);
    }
  }, []);

  const createSession = async () => {
    try {
      setMessage("");

      const finalOptions =
        questionType === "truefalse" ? ["True", "False"] : [option1, option2];

      const res = await fetch(`${BACKEND_URL}/create-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          options: finalOptions,
          type: questionType
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Failed to create session");
        return;
      }

      setSessionId(data.sessionId);
      setResults([]);
      setMessage("Session created successfully");
    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to backend. Make sure server is running.");
    }
  };

  const joinSession = useCallback(() => {
    if (!joinCode.trim()) {
      setMessage("Please enter a session code");
      return;
    }

    setMessage("");
    setJoined(false);
    setJoinedQuestion("");
    setJoinedOptions([]);
    setSelectedOption("");
    setResults([]);
    setHasVoted(false);
    setIsLoadingSession(true);

    socket.emit("join_session", {
      sessionId: joinCode.trim(),
      voterId
    });
  }, [joinCode, voterId]);

  const submitVote = () => {
    if (hasVoted) {
      setMessage("You have already voted in this session");
      return;
    }

    if (!selectedOption) {
      setMessage("Please select an answer first");
      return;
    }

    socket.emit("submit_answer", {
      sessionId: joinCode.trim(),
      answer: selectedOption,
      voterId
    });
  };

  useEffect(() => {
    socket.on("session_data", (data) => {
      setJoined(true);
      setIsLoadingSession(false);
      setJoinedQuestion(data.question);
      setJoinedOptions(data.options);
      setResults(data.answers || []);
      setHasVoted(data.alreadyVoted || false);

      if (data.alreadyVoted) {
        setMessage("You have already voted in this session");
      } else {
        setMessage("Joined session successfully");
      }
    });

    socket.on("update_results", (data) => {
      setResults(data);
    });

    socket.on("vote_success", (msg) => {
      setHasVoted(true);
      setMessage(msg);
    });

    socket.on("vote_error", (msg) => {
      setMessage(msg);
      if (msg.toLowerCase().includes("already voted")) {
        setHasVoted(true);
      }
    });

    socket.on("join_error", (msg) => {
      setMessage(msg);
      setJoined(false);
      setIsLoadingSession(false);
    });

    return () => {
      socket.off("session_data");
      socket.off("update_results");
      socket.off("vote_success");
      socket.off("vote_error");
      socket.off("join_error");
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code");

    if (page === "join" && codeFromUrl && joinCode === codeFromUrl && !joined) {
      joinSession();
    }
  }, [page, joinCode, joined, joinSession]);

  const countResults = () => {
    const counts = {};

    results.forEach((answer) => {
      counts[answer] = (counts[answer] || 0) + 1;
    });

    const total = results.length || 1;

    return joinedOptions.map((option) => ({
      name: option,
      percent: Math.round(((counts[option] || 0) / total) * 100),
      count: counts[option] || 0
    }));
  };

  const btn = {
    width: "100%",
    padding: "12px",
    margin: "6px 0",
    border: "none",
    borderRadius: "10px",
    background: "#4facfe",
    color: "white",
    fontSize: "16px",
    cursor: "pointer"
  };

  const secondaryBtn = {
    width: "100%",
    padding: "12px",
    margin: "6px 0",
    border: "1px solid #d0d7de",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#222",
    fontSize: "16px",
    cursor: "pointer"
  };

  const selectedBtn = {
    ...secondaryBtn,
    background: "#dff1ff",
    border: "2px solid #4facfe",
    fontWeight: "bold"
  };

  const disabledBtn = {
    ...secondaryBtn,
    background: "#f2f2f2",
    color: "#999",
    cursor: "not-allowed"
  };

  const input = {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "14px",
    boxSizing: "border-box"
  };

  const card = {
    background: "white",
    padding: "30px",
    borderRadius: "18px",
    width: "420px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
  };

  const qrLink = `${FRONTEND_URL}?code=${sessionId}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #4facfe, #00f2fe)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px"
      }}
    >
      <div style={card}>
        {page === "home" && (
          <>
            <h1 style={{ marginBottom: "10px" }}>Mentimeter Clone</h1>
            <p style={{ color: "#666", marginBottom: "24px" }}>
              Interactive live polling for education
            </p>

            <button style={btn} onClick={() => setPage("create")}>
              Create Poll
            </button>

            <button style={btn} onClick={() => setPage("join")}>
              Join Poll
            </button>
          </>
        )}

        {page === "create" && (
          <>
            <h2>Create Poll</h2>

            <button style={secondaryBtn} onClick={() => setPage("home")}>
              ← Back
            </button>

            <br />

            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              style={input}
            >
              <option value="multiple">Multiple Choice</option>
              <option value="truefalse">True / False</option>
            </select>

            <br />
            <br />

            <input
              style={input}
              placeholder="Enter your question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />

            <br />
            <br />

            {questionType === "multiple" && (
              <>
                <input
                  style={input}
                  placeholder="Option 1"
                  value={option1}
                  onChange={(e) => setOption1(e.target.value)}
                />

                <br />
                <br />

                <input
                  style={input}
                  placeholder="Option 2"
                  value={option2}
                  onChange={(e) => setOption2(e.target.value)}
                />

                <br />
                <br />
              </>
            )}

            <button style={btn} onClick={createSession}>
              Create Session
            </button>

            {sessionId && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  background: "#f5fbff",
                  borderRadius: "12px",
                  border: "1px solid #dbefff"
                }}
              >
                <h3 style={{ margin: 0 }}>Session Code: {sessionId}</h3>
                <p style={{ marginTop: "8px", color: "#666" }}>
                  Scan this QR to open and join from phone
                </p>

                <div
                  style={{
                    marginTop: "15px",
                    display: "flex",
                    justifyContent: "center",
                    background: "white",
                    padding: "10px",
                    borderRadius: "12px"
                  }}
                >
                  <QRCode value={qrLink} />
                </div>

                <p
                  style={{
                    marginTop: "12px",
                    fontSize: "12px",
                    color: "#666",
                    wordBreak: "break-all"
                  }}
                >
                  Link: {qrLink}
                </p>
              </div>
            )}
          </>
        )}

        {page === "join" && (
          <>
            <h2>Join Poll</h2>

            <button style={secondaryBtn} onClick={() => setPage("home")}>
              ← Back
            </button>

            <br />

            <input
              style={input}
              placeholder="Enter session code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />

            <br />
            <br />

            <button style={btn} onClick={joinSession}>
              Join Session
            </button>

            {isLoadingSession && (
              <p style={{ marginTop: "16px", color: "#666" }}>
                Loading session...
              </p>
            )}

            {joined && (
              <>
                <div
                  style={{
                    marginTop: "20px",
                    padding: "16px",
                    background: "#f9fafb",
                    borderRadius: "12px",
                    textAlign: "left"
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>Question</h3>
                  <p style={{ fontWeight: "bold" }}>{joinedQuestion}</p>

                  <h4>Choose one answer</h4>

                  {joinedOptions.map((option, index) => (
                    <button
                      key={index}
                      style={
                        hasVoted
                          ? disabledBtn
                          : selectedOption === option
                          ? selectedBtn
                          : secondaryBtn
                      }
                      onClick={() => {
                        if (!hasVoted) {
                          setSelectedOption(option);
                        }
                      }}
                      disabled={hasVoted}
                    >
                      {option}
                    </button>
                  ))}

                  <button
                    style={hasVoted ? disabledBtn : btn}
                    onClick={submitVote}
                    disabled={hasVoted}
                  >
                    {hasVoted ? "Vote Submitted" : "Submit Vote"}
                  </button>
                </div>

                <div style={{ marginTop: "20px", textAlign: "left" }}>
                  <h3>Live Results</h3>

                  {countResults().map((item, index) => (
                    <div key={index} style={{ marginBottom: "14px" }}>
                      <div style={{ marginBottom: "6px" }}>
                        {item.name} — {item.percent}% ({item.count} votes)
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: "22px",
                          background: "#e9eef5",
                          borderRadius: "999px",
                          overflow: "hidden"
                        }}
                      >
                        <div
                          style={{
                            width: `${item.percent}%`,
                            height: "100%",
                            background:
                              "linear-gradient(90deg, #4facfe, #00c6ff)",
                            borderRadius: "999px",
                            transition: "width 0.3s ease"
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {message && (
          <p style={{ marginTop: "18px", color: "#444", fontSize: "14px" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;