import { generateObject } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import { nanoid } from "nanoid"

const questionSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["multiple-choice", "short-answer"]),
      question: z.string(),
      options: z.array(z.string()).optional(),
      correctAnswer: z.string().optional(),
      explanation: z.string().optional(),
      points: z.number(),
    }),
  ),
})

// 임시 저장소 (실제 환경에서는 데이터베이스 사용)
const rooms = new Map()

// 6자리 초대코드 생성 함수
function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("pdf") as File
    const questionTypes = JSON.parse(formData.get("questionTypes") as string)
    const questionCount = Number.parseInt(formData.get("questionCount") as string)
    const difficulty = formData.get("difficulty") as string
    const timeLimit = Number.parseInt(formData.get("timeLimit") as string)

    if (!file) {
      return new Response("PDF file is required", { status: 400 })
    }

    const difficultyPrompts = {
      easy: "기본적인 개념과 용어를 묻는 쉬운 문제",
      medium: "개념을 이해하고 적용할 수 있는 중간 난이도 문제",
      hard: "심화 사고와 분석이 필요한 어려운 문제",
    }

    const typePrompts = {
      "multiple-choice": "4개의 선택지가 있는 객관식 문제",
      "short-answer": "한 단어나 짧은 구문으로 답할 수 있는 단답식 문제",
    }

    const selectedTypePrompts = questionTypes
      .map((type: string) => typePrompts[type as keyof typeof typePrompts])
      .join(", ")

    // ---------- 1) provider 우선순위 ---------- //
    const hasGoogle = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim())
    const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY?.trim())

    // 1) 시도 순서: gemini-flash(저렴) → gemini-pro → Mock
    const providers: Array<ReturnType<typeof google> | "mock"> = []

    if (hasGoogle) {
      providers.push(google("gemini-1.5-flash")) // 가장 저렴
      providers.push(google("gemini-1.5-pro-latest")) // 동일 키지만 pro
    }
    providers.push("mock") // 모든 모델 실패 시 사용

    // ---------- 2) 순차 시도 & 폴백 ---------- //
    let result: z.infer<typeof questionSchema> | null = null
    let lastError: unknown = null

    for (const model of providers) {
      try {
        if (model === "mock") {
          // Mock branch (도달 시 즉시 생성)
          result = {
            questions: Array.from({ length: 5 }, (_, i) => ({
              id: `mock-${i + 1}`,
              type: "multiple-choice" as const,
              question: `임시 문제 ${i + 1}: 쿼터 초과 시 표시되는 더미 문항입니다.`,
              options: ["A", "B", "C", "D"],
              correctAnswer: "A",
              explanation: "실제 AI 문제가 아니라 쿼터 초과 안내용 더미입니다.",
              points: 1,
            })),
          }
          break
        }

        const r = await generateObject({
          model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `다음 PDF 강의자료를 분석하여 ${questionCount}개의 문제를 생성해주세요.

요구사항:
- 문제 유형: ${selectedTypePrompts}
- 난이도: ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts]}
- 각 문제는 고유한 ID를 가져야 합니다
- 객관식 문제는 4개의 선택지와 정답을 포함해야 합니다
- 모든 문제에 대한 설명을 포함해주세요
- 문제별 점수를 설정해주세요 (1-10점)

PDF 내용을 바탕으로 학습자가 핵심 개념을 이해했는지 확인할 수 있는 문제를 만들어주세요.`,
                },
                {
                  type: "file",
                  data: await file.arrayBuffer(),
                  mimeType: "application/pdf",
                },
              ],
            },
          ],
          schema: questionSchema,
        })
        result = r.object
        break // 성공 시 루프 탈출
      } catch (err: any) {
        lastError = err
        // 쿼터/속도 초과 에러가 아닌 경우 즉시 중단
        const msg = String(err?.message || "")
        if (!/quota|rate/i.test(msg)) break
        // quota 에러면 다음 provider 시도
      }
    }

    if (!result) {
      // 모든 실제 모델 실패 → Mock 문제 생성
      if (lastError && /quota|rate/i.test(String(lastError))) {
        // 최소한 UI가 동작하도록 5개의 임시 문제 반환
        result = {
          questions: Array.from({ length: 5 }, (_, i) => ({
            id: `mock-${i + 1}`,
            type: "multiple-choice" as const,
            question: `임시 문제 ${i + 1}: 쿼터 초과 시 표시되는 더미 문항입니다.`,
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
            explanation: "실제 AI 문제가 아니라 쿼터 초과 안내용 더미입니다.",
            points: 1,
          })),
        }
      } else {
        console.error("AI provider error:", lastError)
        return new Response("All AI providers failed. Please add a valid API key or wait for your quota to reset.", {
          status: 429,
        })
      }
    }

    // 룸 생성
    const roomId = nanoid()
    const inviteCode = generateInviteCode()
    const isMock = result.questions[0]?.id.startsWith("mock-")
    rooms.set(roomId, {
      id: roomId,
      inviteCode,
      questions: result.questions,
      participants: [],
      currentQuestion: 0,
      status: "waiting", // waiting, active, finished
      scores: {},
      timeLimit, // 제한시간 추가
      createdAt: new Date(),
      isMock,
    })

    return Response.json({ roomId, inviteCode, questionsCount: result.questions.length })
  } catch (error: any) {
    console.error("AI provider error:", error?.message ?? error)
    return new Response("Failed to generate questions – check that your API key is valid.", { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const roomId = url.searchParams.get("roomId")

  if (!roomId || !rooms.has(roomId)) {
    return new Response("Room not found", { status: 404 })
  }

  return Response.json(rooms.get(roomId))
}
