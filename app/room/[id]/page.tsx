"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Trophy,
  Clock,
  Share2,
  Send,
  MessageCircle,
  Timer,
  Medal,
  Star,
} from "lucide-react";
import { Label } from "@/components/ui/label";

interface Question {
  id: string;
  type: "MULTIPLE_CHOICE" | "multiple_choice" | "SHORT_ANSWER" | "short_answer";
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  points: number;
}

interface Room {
  id: string;
  questions: Question[];
  participants: string[];
  currentQuestion: number;
  status: "waiting" | "active" | "finished";
  scores: Record<string, number>;
  inviteCode?: string;
  timeLimit: number;
  hostUserId?: string;
}

interface Participant {
  id: string;
  name: string;
  score: number;
  isReady: boolean;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  type: "message" | "system";
}

// =================================================================
// 최적화를 위한 자식 컴포넌트들
// =================================================================

interface QuestionDisplayProps {
  question: Question;
  questionNumber: number;
  selectedAnswer: string;
  onSelectAnswer: (answer: string) => void;
  textAnswer: string;
  onTextAnswerChange: (answer: string) => void;
  hasSubmitted: boolean;
  onSubmit: () => void;
}

const QuestionDisplay = React.memo(
  ({
    question,
    questionNumber,
    selectedAnswer,
    onSelectAnswer,
    textAnswer,
    onTextAnswerChange,
    hasSubmitted,
    onSubmit,
  }: QuestionDisplayProps) => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>문제 {questionNumber}</CardTitle>
          <CardDescription>
            {question.type.toLowerCase().includes("multiple_choice") ? "객관식" : "단답식"} / {question.points}점
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-lg mb-4">{question.question}</p>
          {(question.type === "MULTIPLE_CHOICE" ||
            question.type === "multiple_choice") &&
            question.options && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {question.options?.map((option, index) => (
                  <Button
                    key={index}
                    variant={selectedAnswer === String(index) ? "default" : "outline"}
                    onClick={() => onSelectAnswer(String(index))}
                    disabled={hasSubmitted}
                    className="text-left justify-start p-4 h-auto whitespace-normal"
                  >
                    <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
                    {option}
                  </Button>
                ))}
              </div>
            )}

          {(question.type === "short_answer" ||
            question.type === "SHORT_ANSWER") && (
            <Input
              placeholder="답을 입력하세요"
              value={textAnswer}
              onChange={(e) => onTextAnswerChange(e.target.value)}
              disabled={hasSubmitted}
              onKeyPress={(e) => e.key === "Enter" && !hasSubmitted && onSubmit()}
            />
          )}
        </CardContent>
      </Card>
    );
  }
);
QuestionDisplay.displayName = "QuestionDisplay";

const AnswerResult = React.memo(({
  userAnswer,
  question,
}: {
  userAnswer: { answer: string; isCorrect: boolean; points: number } | undefined;
  question: Question | undefined;
}) => {
  if (!userAnswer || !question) return null;

  const myAnswerIndex = userAnswer.answer !== undefined ? parseInt(userAnswer.answer) : -1;
  const correctAnswerIndex = parseInt(question.correctAnswer ?? "-1");

  const myAnswerText = myAnswerIndex >= 0 && question.options?.[myAnswerIndex]
    ? question.options[myAnswerIndex]
    : myAnswerIndex === -1 ? "선택 안함" : "오류";

  const correctAnswerText = correctAnswerIndex >= 0 && question.options?.[correctAnswerIndex]
    ? question.options[correctAnswerIndex]
    : "정답 정보 없음";

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">답안 결과</h3>
          <Badge variant={userAnswer.isCorrect ? "default" : "destructive"}>
            {userAnswer.isCorrect ? "정답" : "오답"}
          </Badge>
        </div>
        <div>
          <Label>내 답안:</Label>
          <div className="mt-1 p-3 bg-gray-100 rounded-lg">
            {question.type.toLowerCase().includes("multiple_choice")
              ? `${String.fromCharCode(65 + myAnswerIndex)}. ${myAnswerText}`
              : userAnswer.answer || "입력 안함"}
          </div>
        </div>
        <div className="mt-4">
          <Label className="text-green-600">정답:</Label>
          <div className="mt-1 p-3 bg-green-50 text-green-800 border border-green-200 rounded-lg">
            {question.type.toLowerCase().includes("multiple_choice")
              ? `${String.fromCharCode(65 + correctAnswerIndex)}. ${correctAnswerText}`
              : question.correctAnswer}
          </div>
        </div>
        {question.explanation && (
          <div className="mt-4">
            <Label className="text-blue-600">해설:</Label>
            <div className="mt-1 p-3 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg whitespace-pre-wrap">
              {question.explanation}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
AnswerResult.displayName = "AnswerResult";

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [userName, setUserName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [showResults, setShowResults] = useState(false);
  const [showResultsLatch, setShowResultsLatch] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [timerRef, setTimerRef] = useState<NodeJS.Timeout | null>(null);
  const [pollIntervalRef, setPollIntervalRef] = useState<NodeJS.Timeout | null>(
    null
  );
  const [isLastQuestion, setIsLastQuestion] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [showFinalScoreModal, setShowFinalScoreModal] = useState(false);
  const [finalRanking, setFinalRanking] = useState<any[]>([]);

  // 개인별 문제 진행 상태 관리
  const [userCurrentQuestion, setUserCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<
    Record<number, { answer: string; isCorrect: boolean; points: number }>
  >({});
  const [userScore, setUserScore] = useState(0);

  // WebSocket 관련 상태
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // WebSocket 연결 후 join 메시지 전송 (한 번만)
  const [hasJoinedWebSocket, setHasJoinedWebSocket] = useState(false);
  const [shouldAutoJoin, setShouldAutoJoin] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinRetryCount, setJoinRetryCount] = useState(0);
  const [maxJoinRetries] = useState(5);
  // Stable user ID for the session, to prevent creating new users on retry
  const [userId] = useState(() => `user_${Date.now()}`);

  // 채팅 스크롤 관리
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // 채팅 스크롤을 아래로 이동
  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      // ScrollArea 컴포넌트 내부의 실제 스크롤 요소를 찾아서 스크롤
      const scrollElement = chatScrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      } else {
        // 백업: 직접 스크롤
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }
  };

  // 타이머 시작 함수
  const startTimer = (duration: number) => {
    if (timerRef) {
      clearInterval(timerRef);
    }
    setTimeLeft(duration);
    const newTimerRef = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(newTimerRef);
          autoSubmitAnswer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setTimerRef(newTimerRef);
  };

  // 자동 제출 함수
  const autoSubmitAnswer = async () => {
    if (!currentUser || !room || hasSubmitted) return;

    const answer =
      room.questions[userCurrentQuestion].type === "MULTIPLE_CHOICE"
        ? selectedAnswer
        : textAnswer;

    try {
      const response = await fetch(
        `http://localhost:8080/api/game/submit-answer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId,
            userId: currentUser,
            questionId: room.questions[userCurrentQuestion].id,
            answer: answer || "",
            timestamp: Date.now(),
            isAutoSubmit: true,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();

        // 서버 응답에서 정답 여부와 점수를 받아옴
        const isCorrect = result.isCorrect || false;
        const points = result.points || 0;

        setUserAnswers((prev) => ({
          ...prev,
          [userCurrentQuestion]: {
            answer,
            isCorrect,
            points,
          },
        }));

        setUserScore((prev) => prev + points);
        setShowResults(true);
        setShowResultsLatch(true);
      }
    } catch (error) {
      console.error("Failed to auto submit answer:", error);
    }

    setHasSubmitted(true);
    setSelectedAnswer("");
    setTextAnswer("");
  };

  // 연결 오류 상태 관리
  const [connectionError, setConnectionError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // 방 정보 폴링
  const pollRoomInfo = async () => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/game/room/${roomId}`
      );
      if (response.ok) {
        const roomData = await response.json();

        // 연결 성공 시 오류 상태 초기화
        setConnectionError(false);
        setRetryCount(0);

        console.log("방 정보 수신:", roomData);
        console.log("문제 개수:", roomData.questions?.length || 0);
        if (roomData.questions && roomData.questions.length > 0) {
          console.log("첫 번째 문제:", roomData.questions[0]);
        }
        console.log(roomData);

        // 현재 문제가 변경되었을 때 (방장이 다음 문제로 넘어갔을 때)
        if (
          room &&
          roomData.currentQuestion !== room.currentQuestion &&
          gameStarted &&
          hasJoined
        ) {
          console.log(
            `문제 변경 감지: ${room.currentQuestion} -> ${roomData.currentQuestion}`
          );
          setUserCurrentQuestion(roomData.currentQuestion);
          setIsLastQuestion(
            roomData.currentQuestion >= roomData.questions.length - 1
          );
          setShowResults(false);
          setShowResultsLatch(false);
          setHasSubmitted(false);
          setSelectedAnswer("");
          setTextAnswer("");

          // 타이머 재시작
          if (timerRef) {
            clearInterval(timerRef);
          }
          startTimer(roomData.timeLimit || 30);

          // 시스템 메시지 추가
          const systemMessage: ChatMessage = {
            id: `system_${Date.now()}`,
            userId: "system",
            userName: "시스템",
            message: `문제 ${roomData.currentQuestion + 1}번이 시작되었습니다.`,
            timestamp: Date.now(),
            type: "system",
          };
          setChatMessages((prev) => [...prev, systemMessage]);
        }

        // 퀴즈가 종료된 경우
        if (
          room &&
          roomData.status === "finished" &&
          room.status !== "finished" &&
          hasJoined
        ) {
          setQuizFinished(true);
          if (timerRef) {
            clearInterval(timerRef);
          }

          // 최종 순위 계산
          const ranking = roomData.participants
            .map((participant: Participant) => ({
              ...participant,
              displayScore:
                participant.id === currentUser ? userScore : participant.score,
            }))
            .sort((a: any, b: any) => b.displayScore - a.displayScore);

            setFinalRanking(ranking);
            setShowFinalScoreModal(true);

            // 시스템 메시지 추가
            const systemMessage: ChatMessage = {
              id: `system_${Date.now()}`,
              userId: "system",
              userName: "시스템",
              message: "퀴즈가 종료되었습니다!",
              timestamp: Date.now(),
              type: "system",
            };
            setChatMessages((prev) => [...prev, systemMessage]);
        }

        setRoom(roomData);
        setParticipants(roomData.participants || []);

        // 방에 입장하지 않은 상태에서만 문제를 숨김
        if (!hasJoined) {
          setShowResults(false);
        }
      }
    } catch (error) {
      console.error("Failed to poll room info:", error);
      setConnectionError(true);
      setRetryCount((prev) => prev + 1);

      // 최대 재시도 횟수 초과 시 폴링 중단
      if (retryCount >= maxRetries) {
        console.warn("최대 재시도 횟수 초과. 폴링을 중단합니다.");
        if (pollIntervalRef) {
          clearInterval(pollIntervalRef);
          setPollIntervalRef(null);
        }
      }
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const nameFromUrl = urlParams.get("name");
    const isHostParam = urlParams.get("isHost");
    
    if (nameFromUrl) {
      setUserName(nameFromUrl);
      if (isHostParam === "true") {
        setIsHost(true);
      }
      setShouldAutoJoin(true);
    }

    // 초기 방 정보 로드
    pollRoomInfo();

    // 주기적으로 방 정보 업데이트 (3초마다)
    const newPollInterval = setInterval(pollRoomInfo, 3000);
    setPollIntervalRef(newPollInterval);

    return () => {
      if (timerRef) {
        clearInterval(timerRef);
      }
      if (pollIntervalRef) {
        clearInterval(pollIntervalRef);
      }
      // WebSocket 연결 해제
      disconnectWebSocket();
    };
  }, [roomId]);

  // URL에서 이름을 받았고 방 정보가 로드되었을 때 자동 입장
  useEffect(() => {
    if (shouldAutoJoin && room && !hasJoined && !isJoining && userName) {
      // 자동으로 방에 입장
      setShouldAutoJoin(false); // 한 번만 실행되도록
      joinRoom(0);
    }
  }, [shouldAutoJoin, room, userName, hasJoined, isJoining]);

  // 게임 상태 동기화
  useEffect(() => {
    if (room) {
      setGameStarted(room.status === "active");
    }
  }, [room]);

  // WebSocket 연결 후 join 메시지 전송 (한 번만)
  useEffect(() => {
    if (
      socket &&
      socket.readyState === WebSocket.OPEN &&
      currentUser &&
      userName &&
      room &&
      hasJoined &&
      !hasJoinedWebSocket
    ) {
      socket.send(
        JSON.stringify({
          type: "join",
          roomId: room.id,
          userId: currentUser,
          userName: userName,
        })
      );
      console.log("Join 메시지 전송됨");
      setHasJoinedWebSocket(true);
    }
  }, [socket, currentUser, userName, room, hasJoined, hasJoinedWebSocket]);

  // 채팅 메시지가 변경될 때마다 스크롤을 아래로 이동
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const joinRoom = async (retryCount = 0) => {
    if (!userName.trim() || !room || hasJoined) return;

    if (retryCount === 0) {
      setIsJoining(true);
    }

    try {
      const response = await fetch(`http://localhost:8080/api/game/join-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, userId, userName: userName.trim() }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const joinData = await response.json();
      setCurrentUser(userId);
      setHasJoined(true);
      setHasJoinedWebSocket(false);
      setIsHost(joinData.isHost || false);
      setGameStarted(joinData.roomStatus === "ACTIVE");

      if (joinData.roomStatus !== "ACTIVE") {
        setShowResults(false);
      }

      setHasSubmitted(false);
      setSelectedAnswer("");
      setTextAnswer("");
      setUserCurrentQuestion(0);
      setUserAnswers({});
      setUserScore(0);
      setIsLastQuestion(false);
      setQuizFinished(false);
      
      setJoinRetryCount(0);
      setIsJoining(false);
      console.log("방 참가 성공!");

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }

      if (joinData.roomStatus === "ACTIVE" && !timerRef) {
        startTimer(room.timeLimit || 30);
      }

    } catch (error) {
      console.error(`방 참가 실패 (시도 ${retryCount + 1}):`, error);
      if (retryCount < maxJoinRetries) {
        const nextRetryCount = retryCount + 1;
        setJoinRetryCount(nextRetryCount);
        setTimeout(() => joinRoom(nextRetryCount), 2000);
      } else {
        alert("방 참여에 실패했습니다. 서버에 연결할 수 없습니다.");
        setIsJoining(false);
        setJoinRetryCount(0);
      }
    }
  };

  const submitAnswer = useCallback(async () => {
    if (!currentUser || !room || hasSubmitted) return;

    const answer =
      room.questions[userCurrentQuestion].type === "MULTIPLE_CHOICE"
        ? selectedAnswer
        : textAnswer;

    try {
      const response = await fetch(
        `http://localhost:8080/api/game/submit-answer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId,
            userId: currentUser,
            questionId: room.questions[userCurrentQuestion].id,
            answer,
            timestamp: Date.now(),
            isAutoSubmit: false,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        const isCorrect = result.isCorrect || false;
        const points = result.points || 0;

        setUserAnswers((prev) => ({
          ...prev,
          [userCurrentQuestion]: { answer, isCorrect, points },
        }));
        setUserScore((prev) => prev + points);
        setShowResults(true);
        setShowResultsLatch(true);

        if (timerRef) {
          clearInterval(timerRef);
        }
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
    }

    setHasSubmitted(true);
    setSelectedAnswer("");
    setTextAnswer("");
  }, [currentUser, room, hasSubmitted, userCurrentQuestion, selectedAnswer, textAnswer, roomId, timerRef]);

  const sendChatMessage = () => {
    if (
      !chatInput.trim() ||
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      !currentUser ||
      !userName
    )
      return;

    const message = {
      type: "chat",
      roomId: roomId,
      userId: currentUser,
      userName: userName,
      message: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };

    socket.send(JSON.stringify(message));
    console.log("채팅 메시지 전송:", message);
    setChatInput("");

    // 메시지 전송 후 스크롤
    setTimeout(scrollToBottom, 100);
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const toggleChat = () => {
    setIsChatVisible(!isChatVisible);
    if (!isChatVisible) {
      setUnreadCount(0);
    }
  };

  const copyInviteCode = () => {
    if (room?.inviteCode) {
      navigator.clipboard.writeText(room.inviteCode);
    }
  };

  const goToMain = () => {
    try {
      // WebSocket 연결 해제
      disconnectWebSocket();

      // 타이머 정리
      if (timerRef) {
        clearInterval(timerRef);
      }
      if (pollIntervalRef) {
        clearInterval(pollIntervalRef);
      }

      // 상태 초기화
      setShowFinalScoreModal(false);

      // 메인 페이지로 강제 이동
      window.location.replace("/");
    } catch (error) {
      console.error("메인 이동 중 오류:", error);
      // 오류가 발생해도 강제 이동
      window.location.href = "/";
    }
  };

  const startGame = useCallback(async () => {
    if (!room || !isHost) return;

    try {
      const response = await fetch(`http://localhost:8080/api/game/start-game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: room.id,
          userId: currentUser,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const gameData = await response.json();
        setGameStarted(true);
        setUserCurrentQuestion(gameData.currentQuestion);
        startTimer(gameData.timeLimit);

        const systemMessage: ChatMessage = {
          id: `system_${Date.now()}`,
          userId: "system",
          userName: "시스템",
          message: "게임이 시작되었습니다!",
          timestamp: Date.now(),
          type: "system",
        };
        setChatMessages((prev) => [...prev, systemMessage]);
      } else {
        throw new Error("Failed to start game");
      }
    } catch (error) {
      console.error("Failed to start game:", error);
      alert("게임을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.");
    }
  }, [room, isHost, currentUser, startTimer]);

  const moveToNextQuestion = useCallback(async () => {
    if (!room || !isHost) return;

    try {
      const response = await fetch(
        `http://localhost:8080/api/game/next-question`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId: room.id,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        if (data.status === "finished") {
          setQuizFinished(true);
          setShowResults(false);
          setShowResultsLatch(false);
          if (timerRef) {
            clearInterval(timerRef);
          }

          if (data.finalScores) {
            const ranking = data.finalScores
              .map((p: Participant) => ({
                ...p,
                displayScore: p.id === currentUser ? userScore : p.score,
              }))
              .sort((a: any, b: any) => b.displayScore - a.displayScore);
            setFinalRanking(ranking);
            setShowFinalScoreModal(true);
          }
        } else {
          setRoom((prev) => prev ? { ...prev, currentQuestion: data.currentQuestion } : null);
          setUserCurrentQuestion(data.currentQuestion);
          setIsLastQuestion(data.isLastQuestion);
          setShowResults(false);
          setShowResultsLatch(false);
          setHasSubmitted(false);
          setSelectedAnswer("");
          setTextAnswer("");
          if (timerRef) {
            clearInterval(timerRef);
          }
          startTimer(room.timeLimit || 30);
          const systemMessage: ChatMessage = {
            id: `system_${Date.now()}`,
            userId: "system",
            userName: "시스템",
            message: `문제 ${data.currentQuestion + 1}번이 시작되었습니다.`,
            timestamp: Date.now(),
            type: "system",
          };
          setChatMessages((prev) => [...prev, systemMessage]);
        }
      }
    } catch (error) {
      console.error("Failed to move to next question:", error);
    }
  }, [room, isHost, currentUser, userScore, timerRef, startTimer]);

  // WebSocket 연결
  const connectWebSocket = () => {
    // 이미 연결되어 있으면 연결하지 않음
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("WebSocket 이미 연결됨");
      return;
    }

    try {
      const ws = new WebSocket("ws://localhost:8080/ws");

      // 연결 타임아웃 설정
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn("WebSocket 연결 타임아웃");
          ws.close();
        }
      }, 5000);

      ws.onopen = () => {
        console.log("WebSocket 연결됨");
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        setSocket(ws);
      };

      ws.onclose = (event) => {
        console.log("WebSocket 연결 해제됨:", event.code, event.reason);
        clearTimeout(connectionTimeout);
        setIsConnected(false);
        setHasJoinedWebSocket(false); // join 상태 초기화

        // 비정상 종료 시에만 로그 출력 (정상 종료는 1000)
        if (event.code !== 1000) {
          console.warn("WebSocket 비정상 종료:", event.code);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket 연결 오류:", error);
        clearTimeout(connectionTimeout);
        setIsConnected(false);
        setHasJoinedWebSocket(false); // join 상태 초기화
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket 메시지 수신:", data);

          if (data.type === "chat") {
            const chatMessage: ChatMessage = {
              id: `msg_${Date.now()}`,
              userId: data.userId,
              userName: data.userName,
              message: data.message,
              timestamp: data.timestamp,
              type: "message",
            };
            setChatMessages((prev) => [...prev, chatMessage]);
            if (!isChatVisible) {
              setUnreadCount((prev) => prev + 1);
            }
          } else if (data.type === "system") {
            const systemMessage: ChatMessage = {
              id: `system_${Date.now()}`,
              userId: "system",
              userName: "시스템",
              message: data.message,
              timestamp: data.timestamp,
              type: "system",
            };
            setChatMessages((prev) => [...prev, systemMessage]);
          } else if (data.type === "participants-update") {
            setParticipants(data.participants || []);
          } else if (data.type === "question-change") {
            // 방장이 다음 문제로 넘어갔을 때 즉시 처리
            console.log("WebSocket을 통한 문제 변경 알림 수신:", data);
            setUserCurrentQuestion(data.currentQuestion);
            setIsLastQuestion(data.isLastQuestion);
            setShowResults(false);
            setShowResultsLatch(false);
            setHasSubmitted(false);
            setSelectedAnswer("");
            setTextAnswer("");

            // 타이머 재시작
            if (timerRef) {
              clearInterval(timerRef);
            }
            startTimer(data.timeLimit || 30);

            // 즉시 방 정보 폴링으로 최신 정보 가져오기
            pollRoomInfo();

            // 시스템 메시지 추가
            const systemMessage: ChatMessage = {
              id: `system_${Date.now()}`,
              userId: "system",
              userName: "시스템",
              message: `문제 ${data.currentQuestion + 1}번이 시작되었습니다.`,
              timestamp: Date.now(),
              type: "system",
            };
            setChatMessages((prev) => [...prev, systemMessage]);
          } else if (data.type === "quiz-finished") {
            // 퀴즈 종료 알림
            console.log("WebSocket을 통한 퀴즈 종료 알림 수신");
            setQuizFinished(true);
            if (timerRef) {
              clearInterval(timerRef);
            }

            // 최종 순위 계산을 위해 방 정보 폴링
            pollRoomInfo();

            // 시스템 메시지 추가
            const systemMessage: ChatMessage = {
              id: `system_${Date.now()}`,
              userId: "system",
              userName: "시스템",
              message: "퀴즈가 종료되었습니다!",
              timestamp: Date.now(),
              type: "system",
            };
            setChatMessages((prev) => [...prev, systemMessage]);
          }
        } catch (error) {
          console.error("메시지 파싱 오류:", error);
        }
      };
    } catch (error) {
      console.error("WebSocket 연결 실패:", error);
      setIsConnected(false);
      setHasJoinedWebSocket(false); // join 상태 초기화
    }
  };

  // WebSocket 연결 해제
  const disconnectWebSocket = () => {
    if (socket) {
      // 퇴장 메시지 전송
      if (currentUser && userName && room) {
        socket.send(
          JSON.stringify({
            type: "leave",
            roomId: room.id,
            userId: currentUser,
            userName: userName,
          })
        );
      }
      socket.close();
    }
    setIsConnected(false);
  };

  // 프로그레스바 색상 계산 함수
  const getProgressColor = (timeLeft: number, totalTime: number) => {
    const percentage = (timeLeft / totalTime) * 100;
    if (percentage > 50) return "bg-green-500";
    if (percentage > 25) return "bg-yellow-500";
    return "bg-red-500";
  };

  // 프로그레스바 값 계산
  const getProgressValue = (timeLeft: number, totalTime: number) => {
    return Math.max(0, (timeLeft / totalTime) * 100);
  };

  if (!room && connectionError && retryCount >= maxRetries) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">연결 오류!</strong>
            <span className="block sm:inline">
              {" "}
              백엔드 서버에 연결할 수 없습니다.
            </span>
          </div>
          <p className="text-gray-600 mb-4">
            백엔드 서버가 실행되고 있는지 확인해주세요.
          </p>
          <Button
            onClick={() => {
              setConnectionError(false);
              setRetryCount(0);
              pollRoomInfo();
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">룸 정보를 불러오는 중...</p>
          {connectionError && (
            <p className="text-yellow-600 mt-2">
              연결 중... ({retryCount}/{maxRetries})
            </p>
          )}
        </div>
      </div>
    );
  }

  // URL에서 이름이 있고 아직 입장하지 않았으며 자동 입장 대기 중일 때는 로딩 화면 표시
  if (shouldAutoJoin && !hasJoined && userName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">방에 입장하는 중...</p>
        </div>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>AI 협업 학습 룸</CardTitle>
            <CardDescription>이름을 입력하고 학습에 참여하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                placeholder="이름을 입력하세요"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && joinRoom(0)}
              />
            </div>
            <Button
              onClick={() => joinRoom(0)}
              className="w-full"
              disabled={!userName.trim() || isJoining}
            >
              {isJoining ? (
                joinRetryCount > 0 ?
                  `재시도 중... (${joinRetryCount}/${maxJoinRetries})`
                  : "입장 중..."
              ) : "룸 참여하기"}
            </Button>
            <div className="text-center"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 게임이 시작되지 않은 경우 대기 화면 표시
  if (hasJoined && !gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-7xl mx-auto">
          {/* 컴팩트한 헤더 */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-gray-800">퀴즈 대기실</h1>
                <Badge variant="outline" className="text-lg font-mono">
                  {room.inviteCode}
                </Badge>
                {isHost && (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    👑 방장
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {participants.length}명
                </Badge>
                <Button variant="outline" size="sm" onClick={copyInviteCode}>
                  <Share2 className="w-4 h-4 mr-2" />
                  초대코드 복사
                </Button>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-4">
            {/* 메인 콘텐츠 영역 */}
            <div className="lg:col-span-3 space-y-4">
              {/* 참가자 목록과 게임 정보를 한 줄에 */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* 참가자 목록 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="w-5 h-5" />
                      참가자 목록 ({participants.length}명)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {participants.map((participant) => (
                        <div
                          key={participant.id}
                          className={`flex items-center justify-between p-2 rounded-lg ${
                            participant.id === currentUser
                              ? "bg-blue-100 border border-blue-300"
                              : "bg-gray-50"
                          }`}
                        >
                          <span className="font-medium text-sm">
                            {participant.name}
                            {participant.id === currentUser && " (나)"}
                            {participant.id === room.hostUserId && " 👑"}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            대기 중
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 게임 정보 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">게임 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 p-3 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {room.questions.length}
                        </div>
                        <div className="text-xs text-blue-600">문제 수</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {room.timeLimit}
                        </div>
                        <div className="text-xs text-green-600">초/문제</div>
                      </div>
                    </div>
                    <div className="text-center">
                      <Badge variant="outline" className="text-sm">
                        대기 중
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 게임 시작 버튼 */}
              <Card>
                <CardContent className="pt-6">
                  {isHost ? (
                    <div className="text-center space-y-3">
                      <p className="text-gray-600">
                        모든 참가자가 준비되었습니다. 게임을 시작하세요!
                      </p>
                      <Button
                        onClick={startGame}
                        className="bg-green-600 hover:bg-green-700 text-lg px-8 py-3"
                        size="lg"
                      >
                        🚀 게임 시작하기
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="animate-pulse">
                        <p className="text-gray-600 mb-2">
                          방장이 게임을 시작할 때까지 기다려주세요...
                        </p>
                        <div className="flex justify-center">
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce mx-1"></div>
                          <div
                            className="w-2 h-2 bg-blue-600 rounded-full animate-bounce mx-1"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-blue-600 rounded-full animate-bounce mx-1"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 우측 사이드바 - 채팅 */}
            <div className="lg:col-span-1">
              <Card className="h-[500px] flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-lg">
                      <MessageCircle className="w-5 h-5" />
                      실시간 채팅
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleChat}
                      className="h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  {/* 채팅 메시지 영역 */}
                  <ScrollArea className="flex-1 px-4 max-h-[350px]">
                    <div className="space-y-2 pb-4">
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`${
                            msg.type === "system" ? "text-center" : ""
                          }`}
                        >
                          {msg.type === "system" ? (
                            <div className="text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1 inline-block">
                              {msg.message}
                            </div>
                          ) : (
                            <div
                              className={`${
                                msg.userId === currentUser
                                  ? "text-right"
                                  : "text-left"
                              }`}
                            >
                              <div
                                className={`inline-block max-w-[85%] p-2 rounded-lg ${
                                  msg.userId === currentUser
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-100 text-gray-900"
                                }`}
                              >
                                {msg.userId !== currentUser && (
                                  <div className="text-xs font-medium mb-1 opacity-70">
                                    {msg.userName}
                                  </div>
                                )}
                                <div className="text-sm">{msg.message}</div>
                                <div className={`text-xs mt-1 opacity-70`}>
                                  {new Date(msg.timestamp).toLocaleTimeString(
                                    "ko-KR",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Separator />

                  {/* 메시지 입력 영역 */}
                  <div className="p-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="메시지를 입력하세요..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendChatMessage();
                          }
                        }}
                        className="flex-1 text-sm"
                      />
                      <Button
                        onClick={sendChatMessage}
                        disabled={!chatInput.trim()}
                        size="sm"
                        className="px-3"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Enter로 전송</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 게임이 시작되지 않았으면 첫 번째 문제로 설정 (에러 방지)
  const currentQuestion =
    room.questions[userCurrentQuestion] || room.questions[0];
  const progress = ((userCurrentQuestion + 1) / room.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">AI 협업 학습</h1>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {participants.length}명 참여
              </Badge>
              <div className="flex items-center gap-2 min-w-[200px]">
                <Timer className="w-4 h-4" />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600">남은 시간</span>
                    <span
                      className={`text-xs font-medium ${
                        timeLeft <= 10 ? "text-red-600" : "text-gray-600"
                      }`}
                    >
                      {timeLeft}초
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(
                        timeLeft,
                        room.timeLimit
                      )}`}
                      style={{
                        width: `${getProgressValue(timeLeft, room.timeLimit)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleChat}
                className="relative"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                채팅
                {unreadCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center mt-2">
            <p className="text-sm text-gray-600">
              문제 {userCurrentQuestion + 1} / {room.questions.length}
            </p>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                문제당 {room.timeLimit}초
              </span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* 메인 문제 영역 */}
          <div
            className={`${isChatVisible ? "lg:col-span-2" : "lg:col-span-3"}`}
          >
            <QuestionDisplay
              question={currentQuestion}
              questionNumber={userCurrentQuestion + 1}
              selectedAnswer={selectedAnswer}
              onSelectAnswer={setSelectedAnswer}
              textAnswer={textAnswer}
              onTextAnswerChange={setTextAnswer}
              hasSubmitted={hasSubmitted}
              onSubmit={submitAnswer}
            />

            <Button
              onClick={submitAnswer}
              className="w-full mt-4"
              disabled={
                hasSubmitted ||
                ((currentQuestion.type === "MULTIPLE_CHOICE" ||
                  currentQuestion.type === "multiple_choice") &&
                  !selectedAnswer) ||
                ((currentQuestion.type === "short_answer" ||
                  currentQuestion.type === "SHORT_ANSWER") &&
                  !textAnswer.trim())
              }
            >
              {hasSubmitted ? "제출완료" : "답안 제출"}
            </Button>

            {timeLeft <= 10 && !hasSubmitted && (
              <div className="text-center text-red-600 font-medium animate-pulse mt-2">
                ⚠️ {timeLeft}초 후 자동 제출됩니다!
              </div>
            )}

            {/* 답안 결과 표시 영역 */}
            <AnswerResult 
              userAnswer={userAnswers[userCurrentQuestion]} 
              question={currentQuestion}
            />

            {/* 다음 문제 버튼 영역 */}
            {hasSubmitted && (
              <Card className="mt-4">
                <CardContent className="pt-6 text-center">
                  {isHost ? (
                    <Button onClick={moveToNextQuestion} size="lg">
                      {isLastQuestion ? "최종 결과 보기" : "다음 문제로"}
                    </Button>
                  ) : (
                    <p>방장이 다음 문제로 넘어가기를 기다리는 중...</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* 사이드바 - 참가자 및 점수 */}
          <div className="space-y-4">
            {/* 초대코드 표시 카드 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-5 h-5" />
                  초대코드
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="bg-gray-100 rounded-lg p-4 mb-3">
                    <div className="text-2xl font-mono font-bold text-blue-600">
                      {room.inviteCode || "ABC123"}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyInviteCode}>
                    <Share2 className="w-4 h-4 mr-2" />
                    초대코드 복사
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  참가자
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className={`flex items-center justify-between p-2 rounded ${
                        participant.id === currentUser
                          ? "bg-blue-100 border border-blue-300"
                          : "bg-gray-50"
                      }`}
                    >
                      <span className="font-medium">
                        {participant.name}
                        {participant.id === currentUser && " (나)"}
                      </span>
                      <Badge variant="secondary">
                        {participant.id === currentUser
                          ? userScore
                          : participant.score}
                        점
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  실시간 순위
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {participants
                    .map((participant: Participant) => ({
                      ...participant,
                      displayScore:
                        participant.id === currentUser
                          ? userScore
                          : participant.score,
                    }))
                    .sort((a: any, b: any) => b.displayScore - a.displayScore)
                    .map((participant: any, index: number) => (
                      <div
                        key={participant.id}
                        className={`flex items-center justify-between p-2 rounded ${
                          index === 0
                            ? "bg-yellow-100 border border-yellow-300"
                            : participant.id === currentUser
                            ? "bg-blue-100 border border-blue-300"
                            : "bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-bold ${
                              index === 0 ? "text-yellow-600" : "text-gray-500"
                            }`}
                          >
                            #{index + 1}
                          </span>
                          <span className="font-medium">
                            {participant.name}
                            {participant.id === currentUser && " (나)"}
                          </span>
                        </div>
                        <span className="font-bold">
                          {participant.displayScore}점
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 실시간 채팅창 */}
          {isChatVisible && (
            <div className="lg:col-span-1">
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-lg">
                      <MessageCircle className="w-5 h-5" />
                      실시간 채팅
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleChat}
                      className="text-xs px-2 py-1 h-auto"
                    >
                      숨기기
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  {/* 채팅 메시지 영역 */}
                  <div className="flex-1 overflow-hidden max-h-[350px]">
                    <ScrollArea ref={chatScrollRef} className="h-full px-4">
                      <div className="space-y-3 pb-4 min-h-full">
                        {chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`${
                              msg.type === "system" ? "text-center" : ""
                            }`}
                          >
                            {msg.type === "system" ? (
                              <div className="text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1 inline-block">
                                {msg.message}
                              </div>
                            ) : (
                              <div
                                className={`${
                                  msg.userId === currentUser
                                    ? "text-right"
                                    : "text-left"
                                }`}
                              >
                                <div
                                  className={`inline-block max-w-[80%] p-2 rounded-lg ${
                                    msg.userId === currentUser
                                      ? "bg-blue-500 text-white"
                                      : "bg-gray-100 text-gray-900"
                                  }`}
                                >
                                  {msg.userId !== currentUser && (
                                    <div className="text-xs font-medium mb-1 opacity-70">
                                      {msg.userName}
                                    </div>
                                  )}
                                  <div className="text-sm">{msg.message}</div>
                                  <div className={`text-xs mt-1 opacity-70`}>
                                    {new Date(msg.timestamp).toLocaleTimeString(
                                      "ko-KR",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <Separator />

                  {/* 메시지 입력 영역 */}
                  <div className="p-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="메시지를 입력하세요..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendChatMessage();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        onClick={sendChatMessage}
                        disabled={!chatInput.trim()}
                        size="sm"
                        className="px-3"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter로 전송, Shift+Enter로 줄바꿈
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* 최종 스코어 모달 */}
      <Dialog open={showFinalScoreModal} onOpenChange={setShowFinalScoreModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-green-600 flex items-center justify-center gap-2">
              <Trophy className="w-8 h-8" />
              🎉 퀴즈 완료! 🎉
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              모든 문제를 완료했습니다. 최종 결과를 확인해보세요!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* 내 점수 하이라이트 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  내 최종 점수
                </h3>
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {userScore}점
                </div>
                <div className="text-sm text-gray-600">
                  총 {room?.questions?.length || 0}문제 중{" "}
                  {Object.keys(userAnswers).length}문제 완료
                </div>
              </div>
            </div>

            {/* 전체 순위 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
                🏆 최종 순위
              </h3>
              <div className="space-y-3">
                {finalRanking.map((participant, index) => {
                  const isCurrentUser = participant.id === currentUser;
                  const isWinner = index === 0;
                  const isMedal = index < 3;

                  return (
                    <div
                      key={participant.id}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                        isCurrentUser
                          ? "bg-blue-100 border-blue-300 ring-2 ring-blue-400"
                          : isWinner
                          ? "bg-yellow-100 border-yellow-300"
                          : isMedal
                          ? "bg-gray-100 border-gray-300"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                            isWinner
                              ? "bg-yellow-500 text-white"
                              : isMedal
                              ? "bg-gray-400 text-white"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {index === 0
                            ? "🥇"
                            : index === 1
                            ? "🥈"
                            : index === 2
                            ? "🥉"
                            : index + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {participant.name}
                            {isCurrentUser && " (나)"}
                          </div>
                          {isWinner && (
                            <div className="text-sm text-yellow-600 font-medium">
                              🎉 우승자!
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-800">
                          {participant.displayScore}점
                        </span>
                        {isMedal && (
                          <Medal
                            className={`w-5 h-5 ${
                              isWinner ? "text-yellow-500" : "text-gray-400"
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 통계 정보 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-3 text-center">
                📊 내 상세 결과
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {
                      Object.values(userAnswers).filter(
                        (answer) => answer.isCorrect
                      ).length
                    }
                  </div>
                  <div className="text-sm text-gray-600">정답</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {
                      Object.values(userAnswers).filter(
                        (answer) => !answer.isCorrect
                      ).length
                    }
                  </div>
                  <div className="text-sm text-gray-600">오답</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(
                      (Object.values(userAnswers).filter(
                        (answer) => answer.isCorrect
                      ).length /
                        Object.keys(userAnswers).length) *
                        100
                    ) || 0}
                    %
                  </div>
                  <div className="text-sm text-gray-600">정답률</div>
                </div>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="flex gap-3">
              <Button
                onClick={goToMain}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                메인으로 돌아가기
              </Button>
              <Button
                onClick={() => setShowFinalScoreModal(false)}
                variant="outline"
                size="lg"
              >
                계속 보기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
