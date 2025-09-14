/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Chat } from "@google/genai";

type Difficulty = "쉬움" | "보통" | "어려움" | "최고난도";
type GameTurn = {
  player: "user" | "ai";
  word: string;
};

const App = () => {
  const [difficulty, setDifficulty] = useState<Difficulty>("보통");
  const [chat, setChat] = useState<Chat | null>(null);
  const [gameHistory, setGameHistory] = useState<GameTurn[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeChat();
  }, [difficulty]);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [gameHistory]);
  
  const getSystemInstruction = (level: Difficulty) => {
    let instruction = `당신은 '끝말잇기' 게임의 AI 상대입니다. 다음 규칙을 엄격하게 준수해주세요.
1.  항상 한 단어의 명사로만 응답하세요.
2.  사용자의 단어가 유효하지 않거나 규칙에 맞지 않으면, 반드시 "INVALID"라고만 응답하세요.
3.  더 이상 이을 단어가 생각나지 않으면, 반드시 "I LOSE"라고만 응답하세요.
4.  주어진 단어의 마지막 글자로 시작하는 단어로 응답해야 합니다.
5.  두음 법칙을 허용합니다. (예: '역사' -> '사력' 또는 '사역')
6.  이전 대화에 나왔던 단어는 다시 사용할 수 없습니다. 사용자가 사용했던 단어를 말하면 "INVALID"라고 응답하세요.
`;
    switch (level) {
      case "쉬움":
        instruction += "7. 쉬운 단어를 사용하세요.";
        break;
      case "보통":
        instruction += "7. 일상적인 단어를 사용하세요.";
        break;
      case "어려움":
        instruction += "7. '륨', '늄', '듐' 처럼 상대방이 다음 단어를 잇기 어려운 한방 단어를 전략적으로 사용하세요.";
        break;
      case "최고난도":
        instruction += `7. 당신은 국어학자입니다. 일상에서 잘 쓰이지 않는 학술 용어, 전문 용어, 고유 명사 등 매우 어려운 단어를 사용하세요.
8. '륨', '늄', '듐' 처럼 상대방이 다음 단어를 잇기 어려운 한방 단어를 매우 적극적으로 사용하세요.
9. 가능한 3글자 이상의 단어를 사용하세요.`;
        break;
    }
    return instruction;
  };

  const initializeChat = () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const newChat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: getSystemInstruction(difficulty),
      },
    });
    setChat(newChat);
    setGameHistory([]);
    setUserInput("");
    setStatusMessage("게임을 시작하려면 첫 단어를 입력하세요.");
    setIsError(false);
    setIsGameOver(false);
  };
  
  const handleNewGame = (level: Difficulty) => {
    setDifficulty(level);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading || !chat || isGameOver) return;

    const userWord = userInput.trim();
    const newHistory = [...gameHistory, { player: "user" as const, word: userWord }];
    setGameHistory(newHistory);
    setUserInput("");
    setIsLoading(true);
    setStatusMessage("AI가 생각 중입니다...");
    setIsError(false);
    
    try {
      // Construct message history for context
      const historyForAI = gameHistory.map(turn => `${turn.player === 'user' ? '사용자' : 'AI'}: ${turn.word}`).join('\n');
      const message = `이전 단어들:\n${historyForAI}\n\n사용자: ${userWord}`;
      
      const response = await chat.sendMessage({ message });
      const aiResponse = response.text.trim();

      if (aiResponse === "INVALID") {
        setIsError(true);
        setStatusMessage(`'${userWord}'는 규칙에 맞지 않는 단어입니다. 다시 시도하세요.`);
        setGameHistory(gameHistory); // Revert history
      } else if (aiResponse === "I LOSE") {
        setIsGameOver(true);
        setStatusMessage("당신이 이겼습니다! AI가 단어를 찾지 못했습니다.");
      } else {
        const aiWord = aiResponse;
        setGameHistory([...newHistory, { player: "ai", word: aiWord }]);
        setStatusMessage("당신의 차례입니다.");
      }
    } catch (error) {
      console.error(error);
      setIsError(true);
      setStatusMessage("오류가 발생했습니다. 다시 시도해주세요.");
      setGameHistory(gameHistory); // Revert history
    } finally {
      setIsLoading(false);
    }
  };

  const currentWord = gameHistory.length > 0 ? gameHistory[gameHistory.length - 1].word : "";
  const lastChar = currentWord ? currentWord[currentWord.length - 1] : "";

  return (
    <div className="app-container">
      <header>
        <h1>한국어 끝말잇기</h1>
        <p>AI와 함께하는 끝말잇기 게임</p>
      </header>
      
      <div className="difficulty-selector">
        {(["쉬움", "보통", "어려움", "최고난도"] as Difficulty[]).map((level) => (
          <button 
            key={level} 
            className={difficulty === level ? 'active' : ''}
            onClick={() => handleNewGame(level)}
            aria-pressed={difficulty === level}
          >
            {level}
          </button>
        ))}
      </div>

      <main className="game-area">
        <div className="game-history" ref={historyRef} aria-live="polite">
          {gameHistory.length === 0 && <p style={{color: '#999', alignSelf: 'center', margin: 'auto'}}>게임 기록이 여기에 표시됩니다.</p>}
          {gameHistory.map((turn, index) => (
            <div key={index} className={`chat-bubble ${turn.player}`}>
              {turn.word}
            </div>
          ))}
        </div>

        {!isGameOver && (
          <>
            <div className="current-word">
              {lastChar ? (
                <>
                  다음 단어는 <span aria-label={`시작 글자: ${lastChar}`}>{lastChar}</span> (으)로 시작합니다.
                </>
              ) : (
                "첫 단어를 입력해주세요."
              )}
            </div>
            <form className="input-form" onSubmit={handleSubmit}>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={isLoading ? "AI가 생각 중..." : "단어를 입력하세요"}
                disabled={isLoading}
                aria-label="단어 입력"
              />
              <button type="submit" disabled={isLoading || !userInput.trim()}>
                {isLoading ? "..." : "입력"}
              </button>
            </form>
          </>
        )}
      </main>
      
      <footer>
        <div 
          className={`game-status ${isError ? 'error' : ''} ${isGameOver && statusMessage.includes('이겼습니다') ? 'win' : ''} ${isGameOver && statusMessage.includes('졌습니다') ? 'lose' : ''} ${isLoading ? 'loading' : ''}`}
          aria-live="assertive"
        >
          {statusMessage}
        </div>
      </footer>
    </div>
  );
};

const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(<App />);