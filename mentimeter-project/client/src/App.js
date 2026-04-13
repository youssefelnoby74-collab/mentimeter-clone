import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import QRCode from "react-qr-code";

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
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const [isHostPage, setIsHostPage] = useState(false);
  const [hostCode, setHostCode] = useState("");
  const [hostQuestion, setHostQuestion] = useState("");
  const [hostOptions, setHostOptions] = useState([]);
  const [hostResults, setHostResults] = useState([]);
  const [hostLoading, setHostLoading] = useState(true);
  const [hostError, setHostError] = useState("");

  const voterId = getVoterId();
  const frontendUrl = window.location.origin;
  const qrLink = sessionId ? `${frontendUrl}?code=${sessionId}` : "";
  const hostLink = sessionId ? `${frontendUrl}/host?code=${sessionId}` : "";

  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code");

    if (path === "/host") {
      setIsHostPage(true);
      setHostCode(codeFromUrl || "");
      return;
    }

    if (codeFromUrl) {
      setPage("join");
      setJoinCode(codeFromUrl);
    }
  }, []);

  const createSession = async () => {
    if (!question.trim()) {
      setMessage("Please enter a question");
      return;
    }

    if (questionType === "multiple" && (!option1.trim() || !option2.trim())) {
      setMessage("Please enter both options");
      return;
    }

    try {
      setIsCreatingSession(true);
      setMessage("Creating session... please wait");

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
        setIsCreatingSession(false);
        return;
      }

      setSessionId(data.sessionId);
      setResults([]);
      setMessage("Session created successfully");
      setIsCreatingSession(false);
    } catch (error) {
      console.error(error);
      setMessage("Backend may be waking up on Render. Wait 30 seconds and try again.");
      setIsCreatingSession(false);
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

  const loadHostSession = useCallback(async () => {
    if (!hostCode.trim()) {
      setHostError("No session code found in host link");
      setHostLoading(false);
      return;
    }

    try {
      setHostLoading(true);
      setHostError("");

      const res = await fetch(`${BACKEND_URL}/session/${hostCode}`);
      const data = await res.json();

      if (!res.ok) {
        setHostError(data.error || "Session not found");
        setHostLoading(false);
        return;
      }

      setHostQuestion(data.question);
      setHostOptions(data.options || []);
      setHostResults(data.answers || []);
      setHostLoading(false);

      socket.emit("join_session", {
        sessionId: hostCode,
        voterId: `host_${hostCode}`
      });
    } catch (error) {
      console.error(error);
      setHostError("Failed to load host session");
      setHostLoading(false);
    }
  }, [hostCode]);

  useEffect(() => {
    socket.on("session_data", (data) => {
      if (isHostPage) {
        setHostQuestion(data.question);
        setHostOptions(data.options);
        setHostResults(data.answers || []);
        setHostLoading(false);
      } else {
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
      }
    });

    socket.on("update_results", (data) => {
      if (isHostPage) {
        setHostResults(data);
      } else {
        setResults(data);
      }
    });

   socket.on("vote_success", (msg) => {
  setHasVoted(true);
  setMessage(msg);

  setTimeout(() => {
    setMessage("Showing live results...");
  }, 1500);
});

    socket.on("vote_error", (msg) => {
      setMessage(msg);
      if (msg.toLowerCase().includes("already voted")) {
        setHasVoted(true);
      }
    });

    socket.on("join_error", (msg) => {
      if (isHostPage) {
        setHostError(msg);
        setHostLoading(false);
      } else {
        setMessage(msg);
        setJoined(false);
        setIsLoadingSession(false);
      }
    });

    return () => {
      socket.off("session_data");
      socket.off("update_results");
      socket.off("vote_success");
      socket.off("vote_error");
      socket.off("join_error");
    };
  }, [isHostPage]);

  useEffect(() => {
    if (isHostPage) {
      loadHostSession();
    }
  }, [isHostPage, loadHostSession]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code");

    if (page === "join" && codeFromUrl && joinCode === codeFromUrl && !joined) {
      joinSession();
    }
  }, [page, joinCode, joined, joinSession]);

  const countResults = (optionsList, answersList) => {
    const counts = {};

    answersList.forEach((answer) => {
      counts[answer] = (counts[answer] || 0) + 1;
    });

    const total = answersList.length || 1;

    return optionsList.map((option) => ({
      name: option,
      percent: Math.round(((counts[option] || 0) / total) * 100),
      count: counts[option] || 0
    }));
  };

  const participantResults = countResults(joinedOptions, results);
  const hostResultsData = countResults(hostOptions, hostResults);

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

  if (isHostPage) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #141e30, #243b55)",
          color: "white",
          padding: "40px"
        }}
      >
        {hostLoading && (
          <div style={{ textAlign: "center", marginTop: "120px", fontSize: "24px" }}>
            Loading host screen...
          </div>
        )}

        {hostError && (
          <div style={{ textAlign: "center", marginTop: "120px", fontSize: "24px" }}>
            {hostError}
          </div>
        )}

        {!hostLoading && !hostError && (
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "40px" }}>
              <h1 style={{ fontSize: "52px", marginBottom: "10px" }}>Live Results</h1>
              <p style={{ fontSize: "20px", opacity: 0.9 }}>Session Code: {hostCode}</p>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                borderRadius: "20px",
                padding: "30px",
                marginBottom: "30px"
              }}
            >
              <h2 style={{ fontSize: "38px", marginTop: 0 }}>{hostQuestion}</h2>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                borderRadius: "20px",
                padding: "30px"
              }}
            >
              {hostResultsData.map((item, index) => (
                <div key={index} style={{ marginBottom: "24px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                      fontSize: "24px",
                      fontWeight: "bold"
                    }}
                  >
                    <span>{item.name}</span>
                    <span>
                      {item.percent}% ({item.count} votes)
                    </span>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: "36px",
                      background: "rgba(255,255,255,0.15)",
                      borderRadius: "999px",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        width: `${item.percent}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #00f2fe, #4facfe)",
                        borderRadius: "999px",
                        transition: "width 0.4s ease"
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

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

            <button
              style={isCreatingSession ? disabledBtn : btn}
              onClick={createSession}
              disabled={isCreatingSession}
            >
              {isCreatingSession ? "Creating..." : "Create Session"}
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

                <a
                  href={hostLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    marginTop: "14px",
                    color: "#2563eb",
                    fontWeight: "bold",
                    textDecoration: "none"
                  }}
                >
                  Open Host Screen
                </a>
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

                  {participantResults.map((item, index) => (
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