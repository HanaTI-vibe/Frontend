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
  Users,
  Trophy,
  Clock,
  Share2,
  Send,
  MessageCircle,
  Timer,
} from "lucide-react";

interface Question {
  id: string;
  type: "MULTIPLE_CHOICE" | "short-answer";
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
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [timerRef, setTimerRef] = useState<NodeJS.Timeout | null>(null);
  const [pollIntervalRef, setPollIntervalRef] = useState<NodeJS.Timeout | null>(
    null
  );
  const [isLastQuestion, setIsLastQuestion] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);

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
      await fetch(`http://localhost:8080/api/game/submit-answer`, {
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
      });
    } catch (error) {
      console.error("Failed to auto submit answer:", error);
    }

    setHasSubmitted(true);
    setSelectedAnswer("");
    setTextAnswer("");
  };

  // 방 정보 폴링
  const pollRoomInfo = async () => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/game/room/${roomId}`
      );
      if (response.ok) {
        const roomData = await response.json();
        console.log("방 정보 수신:", roomData);
        console.log("문제 개수:", roomData.questions?.length || 0);
        if (roomData.questions && roomData.questions.length > 0) {
          console.log("첫 번째 문제:", roomData.questions[0]);
        }
        console.log(roomData);
        setRoom(roomData);
        setParticipants(roomData.participants || []);

        // 방에 입장하지 않은 상태에서는 문제를 숨김
        if (!hasJoined) {
          setShowResults(false);
        }
      }
    } catch (error) {
      console.error("Failed to poll room info:", error);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const nameFromUrl = urlParams.get("name");
    if (nameFromUrl) {
      setUserName(nameFromUrl);
      setShouldAutoJoin(true);
    }

    // 초기 방 정보 로드
    pollRoomInfo();

    // 주기적으로 방 정보 업데이트 (5초마다)
    const newPollInterval = setInterval(pollRoomInfo, 5000);
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
      joinRoom();
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

  const joinRoom = async () => {
    // 중복 호출 방지
    if (!userName.trim() || !room || hasJoined || isJoining) return;

    setIsJoining(true);
    const userId = `user_${Date.now()}`;

    try {
      const response = await fetch(`http://localhost:8080/api/game/join-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          userId,
          userName: userName.trim(),
        }),
      });

      if (response.ok) {
        const joinData = await response.json();
        setCurrentUser(userId);
        setHasJoined(true);
        setHasJoinedWebSocket(false);
        setIsHost(joinData.isHost || false);
        setGameStarted(joinData.roomStatus === "ACTIVE");
        setShowResults(false);
        setHasSubmitted(false);
        setSelectedAnswer("");
        setTextAnswer("");

        // 개인 문제 진행 상태 초기화
        setUserCurrentQuestion(0);
        setUserAnswers({});
        setUserScore(0);
        setIsLastQuestion(false);
        setQuizFinished(false);

        // WebSocket이 연결되어 있지 않을 때만 연결
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          connectWebSocket();
        }

        // 게임이 이미 시작된 경우에만 타이머 시작
        if (joinData.roomStatus === "ACTIVE" && !timerRef) {
          startTimer(room.timeLimit || 30);
        }
      }
    } catch (error) {
      console.error("Failed to join room:", error);
    } finally {
      setIsJoining(false);
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

        // 개인 답안 저장
        const currentQuestion = room.questions[userCurrentQuestion];
        const isCorrect =
          currentQuestion.type === "MULTIPLE_CHOICE"
            ? answer === currentQuestion.correctAnswer
            : true; // 단답식은 일단 정답으로 처리

        const points = isCorrect ? currentQuestion.points : 0;

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

  const startGame = async () => {
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
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === "started") {
          setGameStarted(true);
          setRoom((prev) => prev ? {
            ...prev,
            status: "active",
            currentQuestion: 0
          } : null);
          
          // 타이머 시작
          startTimer(data.timeLimit || 30);
          
          // 시스템 메시지 추가
          const systemMessage: ChatMessage = {
            id: `system_${Date.now()}`,
            userId: "system",
            userName: "시스템",
            message: "게임이 시작되었습니다! 첫 번째 문제를 풀어보세요.",
            timestamp: Date.now(),
            type: "system",
          };
          setChatMessages((prev) => [...prev, systemMessage]);
        }
      }
    } catch (error) {
      console.error("Failed to start game:", error);
    }
  };

  const nextQuestion = async () => {
    if (!room) return;

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
        } else {
          // 다음 문제 정보로 업데이트
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  currentQuestion: data.currentQuestion,
                }
              : null
          );

          setIsLastQuestion(data.isLastQuestion);
          setShowResults(false);
          setHasSubmitted(false);
          setSelectedAnswer("");
          setTextAnswer("");

          // 타이머 재시작
          if (timerRef) {
            clearInterval(timerRef);
          }
          startTimer(room.timeLimit || 30);

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
        }
      }
    } catch (error) {
      console.error("Failed to move to next question:", error);
    }
  };

  // 개인별 다음 문제로 넘어가기
  const nextUserQuestion = () => {
    if (!room || userCurrentQuestion >= room.questions.length - 1) {
      setQuizFinished(true);
      setShowResults(false);
      return;
    }

    setUserCurrentQuestion((prev) => prev + 1);
    setShowResults(false);
    setHasSubmitted(false);
    setSelectedAnswer("");
    setTextAnswer("");

    // 타이머 재시작
    if (timerRef) {
      clearInterval(timerRef);
    }
    startTimer(room.timeLimit || 30);

    // 마지막 문제인지 확인
    setIsLastQuestion(userCurrentQuestion + 1 >= room.questions.length - 1);
  };

  // WebSocket 연결
  const connectWebSocket = () => {
    // 이미 연결되어 있으면 연결하지 않음
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("WebSocket 이미 연결됨");
      return;
    }

    try {
      const ws = new WebSocket("ws://localhost:8080/ws");

      ws.onopen = () => {
        console.log("WebSocket 연결됨");
        setIsConnected(true);
        setSocket(ws);
      };

      ws.onclose = () => {
        console.log("WebSocket 연결 해제됨");
        setIsConnected(false);
        setHasJoinedWebSocket(false); // join 상태 초기화
      };

      ws.onerror = (error) => {
        console.error("WebSocket 오류:", error);
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

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">룸 정보를 불러오는 중...</p>
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
                onKeyPress={(e) => e.key === "Enter" && joinRoom()}
              />
            </div>
            <Button
              onClick={joinRoom}
              className="w-full"
              disabled={!userName.trim() || isJoining}
            >
              {isJoining ? "입장 중..." : "룸 참여하기"}
            </Button>
            <div className="text-center">
              <Button variant="outline" size="sm" onClick={copyRoomLink}>
                <Share2 className="w-4 h-4 mr-2" />
                링크 복사
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 게임이 시작되지 않은 경우 대기 화면 표시
  if (hasJoined && !gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-800">
                퀴즈 대기실 - {room.inviteCode}
              </h1>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {participants.length}명 참여
                </Badge>
                {isHost && (
                  <Badge variant="secondary">방장</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* 참가자 목록 */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    참가자 목록
                  </CardTitle>
                  <CardDescription>
                    현재 {participants.length}명이 참여 중입니다
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          participant.id === currentUser
                            ? "bg-blue-100 border border-blue-300"
                            : "bg-gray-50"
                        }`}
                      >
                        <span className="font-medium">
                          {participant.name}
                          {participant.id === currentUser && " (나)"}
                          {participant.id === room.hostUserId && " 👑"}
                        </span>
                        <Badge variant="outline">대기 중</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 게임 정보 및 시작 버튼 */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>게임 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">문제 수:</span>
                    <span className="font-medium">{room.questions.length}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">제한 시간:</span>
                    <span className="font-medium">{room.timeLimit}초/문제</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">상태:</span>
                    <Badge variant="outline">대기 중</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>초대 코드</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="bg-gray-100 rounded-lg p-4 mb-3">
                    <div className="text-2xl font-mono font-bold text-blue-600">
                      {room.inviteCode}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyInviteCode}>
                    <Share2 className="w-4 h-4 mr-2" />
                    코드 복사
                  </Button>
                </CardContent>
              </Card>

              {isHost && (
                <Card>
                  <CardHeader>
                    <CardTitle>게임 시작</CardTitle>
                    <CardDescription>
                      방장만 게임을 시작할 수 있습니다
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={startGame} 
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      게임 시작하기
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!isHost && (
                <Card>
                  <CardContent className="text-center py-6">
                    <p className="text-gray-600">
                      방장이 게임을 시작할 때까지 기다려주세요...
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* 채팅 영역 */}
          {isChatVisible && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
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
                <ScrollArea className="flex-1 px-4 h-48">
                  <div className="space-y-3 pb-4">
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

                {/* 채팅 입력 */}
                <div className="p-4 border-t">
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
          )}
        </div>
      </div>
    );
  }

  // 게임이 시작되지 않았으면 첫 번째 문제로 설정 (에러 방지)
  const currentQuestion = room.questions[userCurrentQuestion] || room.questions[0];
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
                <CardTitle className="flex items-center justify-between">
                  <span>문제 {userCurrentQuestion + 1}</span>
                  <div className="flex items-center gap-2">
                    <Badge>{currentQuestion.points}점</Badge>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">
                          {timeLeft}초
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor(
                              timeLeft,
                              room.timeLimit
                            )}`}
                            style={{
                              width: `${getProgressValue(
                                timeLeft,
                                room.timeLimit
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardTitle>
                <CardDescription>
                  유형:{" "}
                  {currentQuestion.type === "MULTIPLE_CHOICE"
                    ? "객관식"
                    : "단답식"}
                  {hasSubmitted && (
                    <span className="ml-2 text-green-600">✓ 제출완료</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-lg font-medium">
                  {currentQuestion.question}
                </div>

                {currentQuestion.type === "MULTIPLE_CHOICE" &&
                  currentQuestion.options && (
                    <div className="space-y-2">
                      {currentQuestion.options.map((option, index) => (
                        <div
                          key={index}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedAnswer === option
                              ? "bg-blue-100 border-blue-500"
                              : hasSubmitted
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-gray-50"
                          }`}
                          onClick={() =>
                            !hasSubmitted && setSelectedAnswer(option)
                          }
                        >
                          <span className="font-medium mr-2">
                            {String.fromCharCode(65 + index)}.
                          </span>
                          {option}
                        </div>
                      ))}
                    </div>
                  )}

                {currentQuestion.type === "short-answer" && (
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
                  className="w-full"
                  disabled={
                    hasSubmitted ||
                    (currentQuestion.type === "MULTIPLE_CHOICE" &&
                      !selectedAnswer) ||
                    (currentQuestion.type === "short-answer" &&
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

            {showResults && currentQuestion.explanation && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>해설</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{currentQuestion.explanation}</p>
                  {currentQuestion.correctAnswer && (
                    <p className="mt-2 font-medium text-green-600">
                      정답: {currentQuestion.correctAnswer}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 다음 문제 버튼 */}
            {showResults && (
              <Card className="mt-4">
                <CardContent className="pt-6">
                  {quizFinished ? (
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-green-600 mb-4">
                        🎉 퀴즈 완료!
                      </h3>
                      <p className="text-gray-600 mb-4">
                        모든 문제를 풀었습니다.
                      </p>
                      <Button
                        onClick={() => (window.location.href = "/")}
                        variant="outline"
                      >
                        메인으로 돌아가기
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Button
                        onClick={nextUserQuestion}
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        {isLastQuestion ? "퀴즈 완료하기" : "다음 문제로"}
                      </Button>
                      {isLastQuestion && (
                        <p className="text-sm text-gray-500 mt-2">
                          마지막 문제입니다
                        </p>
                      )}
                    </div>
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
                        <div className="flex items-center gap-2">
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
                    <span className="flex items-center gap-2">
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
                  <ScrollArea className="flex-1 px-4">
                    <div className="space-y-3 pb-4">
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
    </div>
  );
}
