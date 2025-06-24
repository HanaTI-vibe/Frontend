"use client";

import { useEffect, useState, useRef } from "react";
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

  // 자동 메인 이동 타이머
  const [autoRedirectTimer, setAutoRedirectTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState(60);

  // 현재 문제에 대한 답안 제출 상태 추적
  const [submittedParticipants, setSubmittedParticipants] = useState<Set<string>>(new Set());

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
        process.env.NEXT_PUBLIC_API_BASE_URL + "/api/game/submit-answer",
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

        // 자신을 제출자 목록에 추가
        setSubmittedParticipants(prev => new Set([...prev, currentUser]));

        // 타이머 정지
        if (timerRef) {
          clearInterval(timerRef);
        }
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
        process.env.NEXT_PUBLIC_API_BASE_URL + `/api/game/room/${roomId}`
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

          // 답안 제출 상태 초기화
          setSubmittedParticipants(new Set());

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

          // 폴링 중단 (퀴즈 종료 시)
          if (pollIntervalRef) {
            clearInterval(pollIntervalRef);
            setPollIntervalRef(null);
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

          // 타이머가 이미 실행 중이 아닐 때만 시작
          if (!autoRedirectTimer) {
            startAutoRedirectTimer();
          }

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
      if (autoRedirectTimer) {
        clearInterval(autoRedirectTimer);
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
      // 퀴즈가 종료되어도 게임 화면을 유지하도록 수정
      setGameStarted(room.status === "active" || room.status === "finished");
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
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_BASE_URL + "/api/game/join-room",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, userId, userName: userName.trim() }),
          signal: AbortSignal.timeout(30000),
        }
      );

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

  const submitAnswer = async () => {
    if (!currentUser || !room || hasSubmitted) return;

    const answer =
      room.questions[userCurrentQuestion].type === "MULTIPLE_CHOICE"
        ? selectedAnswer
        : textAnswer;

    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_BASE_URL + "/api/game/submit-answer",
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

        // 자신을 제출자 목록에 추가
        setSubmittedParticipants(prev => new Set([...prev, currentUser]));

        // 타이머 정지
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
  };

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
      console.log("메인으로 이동 시작");

      // 자동 이동 타이머 정리
      if (autoRedirectTimer) {
        clearInterval(autoRedirectTimer);
        setAutoRedirectTimer(null);
      }

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

      console.log("메인 페이지로 이동: /");
      // 메인 페이지로 강제 이동 - 더 명확하게 처리
      window.location.href = "/";
    } catch (error) {
      console.error("메인 이동 중 오류:", error);
      // 오류가 발생해도 강제 이동
      window.location.href = "/";
    }
  };

  // 자동 메인 이동 타이머 시작
  const startAutoRedirectTimer = () => {
    // 기존 타이머가 있다면 정리
    if (autoRedirectTimer) {
      console.log("기존 타이머 정리");
      clearInterval(autoRedirectTimer);
      setAutoRedirectTimer(null);
    }

    console.log("60초 자동 이동 타이머 시작");
    setAutoRedirectCountdown(60);

    const timer = setInterval(() => {
      setAutoRedirectCountdown((prev) => {
        console.log(`카운트다운: ${prev - 1}초`);
        if (prev <= 1) {
          console.log("타이머 완료 - 메인으로 이동");
          clearInterval(timer);
          setAutoRedirectTimer(null);
          goToMain(); // 60초 후 자동으로 메인으로 이동
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setAutoRedirectTimer(timer);
  };

  const startGame = async () => {
    if (!room || !isHost) return;

    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_BASE_URL + "/api/game/start-game",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId: room.id,
            userId: currentUser,
          }),
          signal: AbortSignal.timeout(30000), // 10초 -> 30초로 연장
        }
      );

      if (response.ok) {
        const gameData = await response.json();
        console.log("게임 시작 성공:", gameData);
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
  };

  // 방장이 다음 문제로 넘어가기 (모든 참가자에게 적용)
  const moveToNextQuestion = async () => {
    if (!isHost || !room) return;

    try {
      // API를 호출하여 백엔드에 다음 문제로 넘어가도록 트리거만 하고,
      // UI 업데이트는 하지 않습니다. UI 업데이트는 WebSocket을 통해 일괄적으로 처리됩니다.
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_BASE_URL + "/api/game/next-question",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roomId, userId: currentUser }),
        }
      );

      if (!response.ok) {
        // 실패 시 사용자에게 알림 (예: toast 메시지)
        console.error("Failed to trigger next question on the server.");
      }

      // 성공 시에도 UI를 직접 변경하지 않습니다.
      // 모든 클라이언트(방장 포함)는 WebSocket의 'question-change' 또는 'quiz-finished'
      // 이벤트를 통해 상태 업데이트를 받게 됩니다.
    } catch (error) {
      console.error("Error calling next question API:", error);
    }
  };

  // WebSocket 연결
  const connectWebSocket = () => {
    // 이미 연결되어 있으면 연결하지 않음
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("WebSocket 이미 연결됨");
      return;
    }

    try {
      const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_BASE_URL + "/ws");

      // 연결 타임아웃 설정
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn("WebSocket 연결 타임아웃");
          ws.close();
        }
      }, 5000);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setConnectionError(false);
        setRetryCount(0);

        // WebSocket 연결 성공 시 폴링 중단
        if (pollIntervalRef) {
          clearInterval(pollIntervalRef);
          setPollIntervalRef(null);
          console.log("Polling stopped due to active WebSocket connection.");
        }

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
          } else if (data.type === "answer-submitted") {
            // 답안 제출 알림
            console.log("WebSocket을 통한 답안 제출 알림 수신:", data);
            setSubmittedParticipants(prev => new Set([...prev, data.userId]));
            
            // 시스템 메시지 추가 (선택적)
            const systemMessage: ChatMessage = {
              id: `system_${Date.now()}`,
              userId: "system",
              userName: "시스템",
              message: `${data.userName}님이 답안을 제출했습니다.`,
              timestamp: Date.now(),
              type: "system",
            };
            setChatMessages((prev) => [...prev, systemMessage]);
          } else if (data.type === "game-started") {
            // 게임 시작 알림
            console.log("WebSocket을 통한 게임 시작 알림 수신:", data);
            setGameStarted(true);
            setUserCurrentQuestion(data.currentQuestion || 0);
            setIsLastQuestion(data.isLastQuestion || false);
            setShowResults(false);
            setShowResultsLatch(false);
            setHasSubmitted(false);
            setSelectedAnswer("");
            setTextAnswer("");

            // 답안 제출 상태 초기화
            setSubmittedParticipants(new Set());

            // 타이머 시작
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
              message: "게임이 시작되었습니다!",
              timestamp: Date.now(),
              type: "system",
            };
            setChatMessages((prev) => [...prev, systemMessage]);
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

            // 답안 제출 상태 초기화
            setSubmittedParticipants(new Set());

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
            console.log("WebSocket을 통한 퀴즈 종료 알림 수신:", data);
            setQuizFinished(true);
            if (timerRef) {
              clearInterval(timerRef);
            }

            // 폴링 중단 (퀴즈 종료 시)
            if (pollIntervalRef) {
              clearInterval(pollIntervalRef);
              setPollIntervalRef(null);
            }

            // 백엔드에서 받은 최종 점수를 사용하여 순위 계산
            const finalScores = data.finalScores || [];
            const ranking = finalScores
              .map((participant: Participant) => ({
                ...participant,
                displayScore: participant.id === currentUser ? userScore : participant.score,
              }))
              .sort((a: any, b: any) => b.displayScore - a.displayScore);

            console.log("최종 순위 계산:", ranking);
            setFinalRanking(ranking);
            setShowFinalScoreModal(true);

            // 타이머가 이미 실행 중이 아닐 때만 시작
            if (!autoRedirectTimer) {
              startAutoRedirectTimer();
            }

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
              {isJoining
                ? joinRetryCount > 0
                  ? `재시도 중... (${joinRetryCount}/${maxJoinRetries})`
                  : "입장 중..."
                : "룸 참여하기"}
            </Button>
            <div className="text-center"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 게임이 시작되지 않은 경우 대기 화면 표시 (단, 퀴즈 종료 상태는 제외)
  if (hasJoined && !gameStarted && room.status !== "finished") {
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
                          className={`flex items-center justify-between p-2 rounded transition-all duration-300 ${
                            participant.id === currentUser
                              ? "bg-blue-100 border border-blue-300"
                              : gameStarted && submittedParticipants.has(participant.id)
                              ? "bg-green-100 border border-green-300 shadow-sm"
                              : "bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {participant.name}
                              {participant.id === currentUser && " (나)"}
                            </span>
                            {gameStarted && submittedParticipants.has(participant.id) && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-green-700 text-xs font-medium">제출완료</span>
                              </div>
                            )}
                          </div>
                          <Badge 
                            variant={
                              gameStarted && submittedParticipants.has(participant.id) 
                                ? "default" 
                                : "secondary"
                            }
                            className={
                              gameStarted && submittedParticipants.has(participant.id)
                                ? "bg-green-600 hover:bg-green-700"
                                : ""
                            }
                          >
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
                      className="h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  {/* 채팅 메시지 영역 */}
                  <ScrollArea
                    ref={chatScrollRef}
                    className="flex-1 px-4 max-h-[450px]"
                  >
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
            <Card>
              <CardHeader>
                <CardTitle>문제 {userCurrentQuestion + 1}</CardTitle>
                <CardDescription>
                  {currentQuestion.type
                    .toLowerCase()
                    .includes("multiple_choice")
                    ? "객관식"
                    : "단답식"}{" "}
                  / {currentQuestion.points}점
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg mb-4">{currentQuestion.question}</p>
                {(currentQuestion.type === "MULTIPLE_CHOICE" ||
                  currentQuestion.type === "multiple_choice") &&
                  currentQuestion.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {room.questions[userCurrentQuestion].options?.map(
                        (option, index) => (
                          <Button
                            key={index}
                            variant={
                              selectedAnswer === String(index)
                                ? "outline-green"
                                : "outline"
                            }
                            onClick={() => setSelectedAnswer(String(index))}
                            disabled={hasSubmitted}
                            className="text-left justify-start p-4 h-auto whitespace-normal"
                          >
                            <span className="font-bold mr-2">
                              {String.fromCharCode(65 + index)}.
                            </span>
                            {option}
                          </Button>
                        )
                      )}
                    </div>
                  )}

                {(currentQuestion.type === "short_answer" ||
                  currentQuestion.type === "SHORT_ANSWER") && (
                  <Input
                    placeholder="답을 입력하세요"
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    disabled={hasSubmitted}
                    onKeyPress={(e) =>
                      e.key === "Enter" && !hasSubmitted && submitAnswer()
                    }
                  />
                )}

                <Button
                  onClick={submitAnswer}
                  variant="green"
                  className="w-full mt-[20px]"
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
                  <div className="text-center text-red-600 font-medium animate-pulse">
                    ⚠️ {timeLeft}초 후 자동 제출됩니다!
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 답안 결과 표시 영역 */}
            {userAnswers[userCurrentQuestion] &&
              (() => {
                const myAnswerIndex =
                  userAnswers[userCurrentQuestion]?.answer !== undefined
                    ? parseInt(userAnswers[userCurrentQuestion].answer)
                    : -1;
                const correctAnswerIndex = parseInt(
                  currentQuestion.correctAnswer ?? "-1"
                );

                const myAnswerText =
                  myAnswerIndex >= 0 &&
                  room.questions[userCurrentQuestion].options?.[myAnswerIndex]
                    ? room.questions[userCurrentQuestion].options[myAnswerIndex]
                    : myAnswerIndex === -1
                    ? "선택 안함"
                    : "오류";

                const correctAnswerText =
                  correctAnswerIndex >= 0 &&
                  room.questions[userCurrentQuestion].options?.[
                    correctAnswerIndex
                  ]
                    ? room.questions[userCurrentQuestion].options[
                        correctAnswerIndex
                      ]
                    : "정답 정보 없음";

                return (
                  <Card className="mt-4">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">답안 결과</h3>
                        <Badge
                          variant={
                            userAnswers[userCurrentQuestion]?.isCorrect
                              ? "default"
                              : "destructive"
                          }
                        >
                          {userAnswers[userCurrentQuestion]?.isCorrect
                            ? "정답"
                            : "오답"}
                        </Badge>
                      </div>

                      {/* 내 답안 */}
                      <div>
                        <Label>내 답안:</Label>
                        <div className="mt-1 p-3 bg-gray-100 rounded-lg">
                          {currentQuestion.type
                            .toLowerCase()
                            .includes("multiple_choice")
                            ? `${String.fromCharCode(
                                65 + myAnswerIndex
                              )}. ${myAnswerText}`
                            : userAnswers[userCurrentQuestion]?.answer ||
                              "입력 안함"}
                        </div>
                      </div>

                      {/* 정답 */}
                      <div className="mt-4">
                        <Label className="text-green-600">정답:</Label>
                        <div className="mt-1 p-3 bg-green-50 text-green-800 border border-green-200 rounded-lg">
                          {currentQuestion.type
                            .toLowerCase()
                            .includes("multiple_choice")
                            ? `${String.fromCharCode(
                                65 + correctAnswerIndex
                              )}. ${correctAnswerText}`
                            : currentQuestion.correctAnswer}
                        </div>
                      </div>

                      {/* 해설 */}
                      <div className="mt-4">
                        <Label className="text-blue-600">해설:</Label>
                        <div className="mt-1 p-3 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg whitespace-pre-wrap">
                          {currentQuestion.explanation}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

            {/* 다음 문제 버튼 영역 */}
            {hasSubmitted && (
              <Card className="mt-4">
                <CardContent className="pt-6 text-center">
                  {isHost ? (
                    <Button
                      onClick={moveToNextQuestion}
                      size="lg"
                      variant="green"
                    >
                      {isLastQuestion ? "결과 공유하기" : "다음 문제로"}
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
                      className={`flex items-center justify-between p-2 rounded transition-all duration-300 ${
                        participant.id === currentUser
                          ? "bg-blue-100 border border-blue-300"
                          : gameStarted && submittedParticipants.has(participant.id)
                          ? "bg-green-100 border border-green-300 shadow-sm"
                          : "bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {participant.name}
                          {participant.id === currentUser && " (나)"}
                        </span>
                        {gameStarted && submittedParticipants.has(participant.id) && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-green-700 text-xs font-medium">제출완료</span>
                          </div>
                        )}
                      </div>
                      <Badge 
                        variant={
                          gameStarted && submittedParticipants.has(participant.id) 
                            ? "default" 
                            : "secondary"
                        }
                        className={
                          gameStarted && submittedParticipants.has(participant.id)
                            ? "bg-green-600 hover:bg-green-700"
                            : ""
                        }
                      >
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
                  <div className="flex-1 overflow-hidden max-h-[450px]">
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
      <Dialog open={showFinalScoreModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-green-600 flex items-center justify-center gap-2">
              <Trophy className="w-8 h-8" />
              🎉 퀴즈 완료! 🎉
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              <div>모든 문제를 완료했습니다. 최종 결과를 확인해보세요!</div>
              {autoRedirectCountdown > 0 && (
                <div className="mt-2 text-sm text-orange-600 font-medium">
                  {autoRedirectCountdown}초 후 자동으로 메인으로 이동합니다
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* 내 점수와 우승자 하이라이트 */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* 내 점수 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-300">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-blue-700 mb-2 flex items-center justify-center gap-2">
                    <Star className="w-5 h-5" />
                    내 최종 점수
                  </h3>
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {userScore}점
                  </div>
                  <div className="text-sm text-blue-600">
                    총 {room?.questions?.length || 0}문제 중{" "}
                    {Object.keys(userAnswers).length}문제 완료
                  </div>
                  {finalRanking.length > 0 && (
                    <div className="mt-2 text-lg font-semibold text-blue-700">
                      {finalRanking.findIndex(p => p.id === currentUser) + 1}등
                    </div>
                  )}
                </div>
              </div>

              {/* 우승자 점수 */}
              {finalRanking.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-lg border-2 border-yellow-300">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-yellow-700 mb-2 flex items-center justify-center gap-2">
                      <Trophy className="w-5 h-5" />
                      우승자
                    </h3>
                    <div className="text-3xl font-bold text-yellow-600 mb-1">
                      {finalRanking[0]?.name}
                    </div>
                    <div className="text-2xl font-bold text-yellow-600 mb-2">
                      {finalRanking[0]?.displayScore}점
                    </div>
                    {finalRanking[0]?.id === currentUser ? (
                      <div className="text-sm text-yellow-700 font-medium">
                        🎉 축하합니다! 🎉
                      </div>
                    ) : (
                      <div className="text-sm text-yellow-600">
                        축하드립니다!
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                      className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200 ${
                        isCurrentUser && isWinner
                          ? "bg-gradient-to-r from-yellow-100 to-blue-100 border-yellow-400 ring-2 ring-yellow-400 shadow-lg"
                          : isCurrentUser
                          ? "bg-gradient-to-r from-blue-100 to-blue-50 border-blue-400 ring-2 ring-blue-400 shadow-md"
                          : isWinner
                          ? "bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-400 shadow-md"
                          : isMedal
                          ? "bg-gradient-to-r from-gray-100 to-gray-50 border-gray-300"
                          : "bg-white border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${
                            isWinner
                              ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-md"
                              : index === 1
                              ? "bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-md"
                              : index === 2
                              ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md"
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
                          <div className={`font-semibold ${
                            isCurrentUser 
                              ? "text-blue-800" 
                              : isWinner 
                              ? "text-yellow-800" 
                              : "text-gray-800"
                          }`}>
                            {participant.name}
                            {isCurrentUser && (
                              <span className="ml-2 text-blue-600 font-bold">(나)</span>
                            )}
                          </div>
                          {isWinner && (
                            <div className="text-sm text-yellow-700 font-medium flex items-center gap-1">
                              <Trophy className="w-4 h-4" />
                              우승자!
                            </div>
                          )}
                          {isCurrentUser && !isWinner && (
                            <div className="text-sm text-blue-600 font-medium">
                              내 순위: {index + 1}등
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${
                          isCurrentUser 
                            ? "text-blue-700" 
                            : isWinner 
                            ? "text-yellow-700" 
                            : "text-gray-800"
                        }`}>
                          {participant.displayScore}점
                        </span>
                        {isMedal && (
                          <Medal
                            className={`w-6 h-6 ${
                              isWinner 
                                ? "text-yellow-500" 
                                : index === 1 
                                ? "text-gray-400" 
                                : "text-amber-600"
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
                {autoRedirectCountdown > 0
                  ? `메인으로 돌아가기 (${autoRedirectCountdown}초)`
                  : "메인으로 돌아가기"}
              </Button>
              <Button
                onClick={() => {
                  if (autoRedirectTimer) {
                    clearInterval(autoRedirectTimer);
                    setAutoRedirectTimer(null);
                    setAutoRedirectCountdown(0);
                  }
                }}
                variant="outline"
                size="lg"
              >
                타이머 정지
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
