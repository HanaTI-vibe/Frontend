import { Server } from "socket.io"
import type { NextRequest } from "next/server"

const rooms = new Map()
const participants = new Map()

interface ChatMessage {
  id: string
  userId: string
  userName: string
  message: string
  timestamp: number
  type: "message" | "system"
}

export async function GET(req: NextRequest) {
  if (!(global as any).io) {
    const io = new Server({
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    })

    io.on("connection", (socket) => {
      console.log("User connected:", socket.id)

      socket.on("join-room", ({ roomId, userId, userName }) => {
        socket.join(roomId)

        if (!participants.has(roomId)) {
          participants.set(roomId, new Map())
        }

        participants.get(roomId).set(userId, {
          id: userId,
          name: userName,
          score: 0,
          isReady: false,
          socketId: socket.id,
        })

        // 룸의 모든 참가자에게 업데이트 전송
        const roomParticipants = Array.from(participants.get(roomId).values())
        io.to(roomId).emit("participants-updated", roomParticipants)

        // 입장 시스템 메시지
        io.to(roomId).emit("system-message", `${userName}님이 입장했습니다.`)
      })

      socket.on("submit-answer", ({ roomId, userId, questionId, answer, timestamp, isAutoSubmit }) => {
        // 답안 처리 로직
        const room = rooms.get(roomId)
        if (!room) return

        const currentQuestion = room.questions[room.currentQuestion]
        let isCorrect = false
        let points = 0

        if (currentQuestion.type === "multiple-choice") {
          isCorrect = answer === currentQuestion.correctAnswer
          points = isCorrect ? currentQuestion.points : 0
        } else {
          // 단답식, 주관식은 별도 채점 로직 필요
          points = Math.floor(currentQuestion.points * 0.8) // 임시 점수
        }

        // 점수 업데이트
        const participant = participants.get(roomId).get(userId)
        if (participant) {
          participant.score += points
        }

        // 결과 전송
        socket.emit("answer-result", {
          isCorrect,
          points,
          explanation: currentQuestion.explanation,
        })

        // 모든 참가자에게 점수 업데이트 전송
        const roomParticipants = Array.from(participants.get(roomId).values())
        io.to(roomId).emit("participants-updated", roomParticipants)

        // 답안 제출 시스템 메시지
        const submitType = isAutoSubmit ? "시간 초과로 자동 제출" : "답안을 제출"
        io.to(roomId).emit("system-message", `${participant.name}님이 ${submitType}했습니다.`)
      })

      // 채팅 메시지 처리
      socket.on("chat-message", ({ roomId, message }) => {
        // 메시지를 룸의 모든 참가자에게 브로드캐스트
        io.to(roomId).emit("chat-message", message)
      })

      socket.on("next-question", ({ roomId }) => {
        const room = rooms.get(roomId)
        if (!room) return

        if (room.currentQuestion < room.questions.length - 1) {
          room.currentQuestion++
          io.to(roomId).emit("question-changed", {
            currentQuestion: room.currentQuestion,
            question: room.questions[room.currentQuestion],
          })

          // 다음 문제 시스템 메시지
          io.to(roomId).emit("system-message", `문제 ${room.currentQuestion + 1}번으로 넘어갑니다.`)
        } else {
          room.status = "finished"
          io.to(roomId).emit("quiz-finished", {
            finalScores: Array.from(participants.get(roomId).values()),
          })

          // 퀴즈 종료 시스템 메시지
          io.to(roomId).emit("system-message", "🎉 퀴즈가 종료되었습니다!")
        }
      })

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id)

        // 연결이 끊긴 사용자 찾기 및 퇴장 메시지
        for (const [roomId, roomParticipants] of participants.entries()) {
          for (const [userId, participant] of roomParticipants.entries()) {
            if (participant.socketId === socket.id) {
              roomParticipants.delete(userId)
              io.to(roomId).emit("system-message", `${participant.name}님이 퇴장했습니다.`)

              // 업데이트된 참가자 목록 전송
              const updatedParticipants = Array.from(roomParticipants.values())
              io.to(roomId).emit("participants-updated", updatedParticipants)
              break
            }
          }
        }
      })

      socket.on("start-timer", ({ roomId, duration }) => {
        // 모든 참가자에게 타이머 시작 신호 전송
        io.to(roomId).emit("timer-sync", { timeLeft: duration })
      })
    })
    ;(global as any).io = io
  }

  return new Response("Socket server initialized")
}
