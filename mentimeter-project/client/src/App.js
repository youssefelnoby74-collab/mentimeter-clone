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

  const [showOnlyResults, setShowOnlyResults] = useState(false);

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
      setMessage("Creating session...");

      const finalOptions =
        questionType === "truefalse" ? ["True", "False"] : [option1, option2];

      const res = await fetch(`${BACKEND_URL}/create-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setMessage("Session created");
      setIsCreatingSession(false);
    } catch (error) {
      setMessage("Server is waking up, try again in few seconds");
      setIsCreatingSession(false);
    }
  };

  const joinSession = useCallback(() => {
    if (!joinCode.trim()) {
      setMessage("Enter session code");
      return;
    }

    setMessage("");
    setJoined(false);
    setSelectedOption("");
    setResults([]);
    setHasVoted(false);
    setShowOnlyResults(false);
    setIsLoadingSession(true);

    socket.emit("join_session", {
      sessionId: joinCode.trim(),
      voterId
    });
  }, [joinCode, voterId]);

  const submitVote = () => {
    if (!selectedOption) {
      setMessage("Select answer first");
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
      }
    });

    socket.on("update_results", (data) => {
      if (isHostPage) setHostResults(data);
      else setResults(data);
    });

    socket.on("vote_success", () => {
      setHasVoted(true);
      setMessage("Vote submitted");

      setTimeout(() => {
        setShowOnlyResults(true);
      }, 1200);
    });

    return () => {
      socket.off("session_data");
      socket.off("update_results");
      socket.off("vote_success");
    };
  }, [isHostPage]);

  const countResults = (optionsList, answersList) => {
    const counts = {};
    answersList.forEach((a) => {
      counts[a] = (counts[a] || 0) + 1;
    });

    const total = answersList.length || 1;

    return optionsList.map((opt) => ({
      name: opt,
      percent: Math.round(((counts[opt] || 0) / total) * 100),
      count: counts[opt] || 0
    }));
  };

  const participantResults = countResults(joinedOptions, results);
  const hostResultsData = countResults(hostOptions, hostResults);

  const btn = {
    width: "100%",
    padding: "12px",
    margin: "6px 0",
    borderRadius: "10px",
    background: "#4facfe",
    color: "white",
    border: "none"
  };

  const input = {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #ccc"
  };

  if (isHostPage) {
    return (
      <div style={{ padding: 40, color: "white", background: "#1e293b", minHeight: "100vh" }}>
        <h1>Live Results</h1>
        <h2>{hostQuestion}</h2>

        {hostResultsData.map((item, i) => (
          <div key={i}>
            {item.name} - {item.percent}%
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: 30 }}>
      {page === "home" && (
        <>
          <button style={btn} onClick={() => setPage("create")}>Create</button>
          <button style={btn} onClick={() => setPage("join")}>Join</button>
        </>
      )}

      {page === "create" && (
        <>
          <input style={input} placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <input style={input} placeholder="Option 1" value={option1} onChange={(e) => setOption1(e.target.value)} />
          <input style={input} placeholder="Option 2" value={option2} onChange={(e) => setOption2(e.target.value)} />

          <button style={btn} onClick={createSession}>
            {isCreatingSession ? "Creating..." : "Create Session"}
          </button>

          {sessionId && (
            <>
              <p>Code: {sessionId}</p>
              <QRCode value={qrLink} />
              <a href={hostLink} target="_blank" rel="noreferrer">Host Screen</a>
            </>
          )}
        </>
      )}

      {page === "join" && (
        <>
          <input style={input} value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
          <button style={btn} onClick={joinSession}>Join</button>

          {joined && (
            <>
              {!showOnlyResults && (
                <>
                  <h3>{joinedQuestion}</h3>

                  {joinedOptions.map((opt, i) => (
                    <button key={i} onClick={() => setSelectedOption(opt)}>
                      {opt}
                    </button>
                  ))}

                  <button style={btn} onClick={submitVote}>Submit</button>
                </>
              )}

              {showOnlyResults && (
                <p>Thanks! Showing results...</p>
              )}

              <h3>Results</h3>
              {participantResults.map((r, i) => (
                <div key={i}>
                  {r.name} - {r.percent}%
                </div>
              ))}
            </>
          )}
        </>
      )}

      <p>{message}</p>
    </div>
  );
}

export default App;