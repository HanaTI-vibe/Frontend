"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Upload, FileText, Users, Brain, ArrowLeft } from "lucide-react"

export default function CreateRoomPage() {
  const [file, setFile] = useState<File | null>(null)
  const [questionTypes, setQuestionTypes] = useState<string[]>(["multiple-choice"])
  const [questionCount, setQuestionCount] = useState("10")
  const [difficulty, setDifficulty] = useState("medium")
  const [isGenerating, setIsGenerating] = useState(false)
  const router = useRouter()
  const [timeLimit, setTimeLimit] = useState("30")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleQuestionTypeChange = (type: string, checked: boolean) => {
    if (checked) {
      setQuestionTypes([...questionTypes, type])
    } else {
      setQuestionTypes(questionTypes.filter((t) => t !== type))
    }
  }

  const handleGenerateQuestions = async () => {
    if (!file || questionTypes.length === 0) return

    setIsGenerating(true)
    const formData = new FormData()
    formData.append("pdf", file)
    formData.append("questionTypes", JSON.stringify(questionTypes))
    formData.append("questionCount", questionCount)
    formData.append("difficulty", difficulty)
    formData.append("timeLimit", timeLimit)

    try {
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const { roomId } = await response.json()
        router.push(`/room/${roomId}`)
      }
    } catch (error) {
      console.error("Failed to generate questions:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            메인으로 돌아가기
          </Button>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">새로운 학습방 만들기</h1>
            <p className="text-lg text-gray-600">강의자료를 업로드하고 AI가 생성한 문제로 친구들과 함께 공부하세요</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                PDF 업로드
              </CardTitle>
              <CardDescription>강의자료 PDF 파일을 업로드해주세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <Label htmlFor="pdf-upload" className="cursor-pointer">
                    <span className="text-sm text-gray-600">클릭하여 PDF 파일 선택</span>
                    <Input
                      id="pdf-upload"
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </Label>
                  {file && <p className="mt-2 text-sm text-green-600">선택된 파일: {file.name}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                문제 설정
              </CardTitle>
              <CardDescription>생성할 문제의 유형과 설정을 선택해주세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">문제 유형</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="multiple-choice"
                      checked={questionTypes.includes("multiple-choice")}
                      onCheckedChange={(checked) => handleQuestionTypeChange("multiple-choice", checked as boolean)}
                    />
                    <Label htmlFor="multiple-choice">객관식</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="short-answer"
                      checked={questionTypes.includes("short-answer")}
                      onCheckedChange={(checked) => handleQuestionTypeChange("short-answer", checked as boolean)}
                    />
                    <Label htmlFor="short-answer">단답식</Label>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="question-count">문제 개수</Label>
                <Select value={questionCount} onValueChange={setQuestionCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5개</SelectItem>
                    <SelectItem value="10">10개</SelectItem>
                    <SelectItem value="15">15개</SelectItem>
                    <SelectItem value="20">20개</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="difficulty">난이도</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">쉬움</SelectItem>
                    <SelectItem value="medium">보통</SelectItem>
                    <SelectItem value="hard">어려움</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="time-limit">문제당 제한시간</Label>
                <Select value={timeLimit} onValueChange={setTimeLimit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15초</SelectItem>
                    <SelectItem value="30">30초</SelectItem>
                    <SelectItem value="45">45초</SelectItem>
                    <SelectItem value="60">60초</SelectItem>
                    <SelectItem value="90">90초</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />방 생성하기
            </CardTitle>
            <CardDescription>문제가 생성되면 친구들과 공유할 수 있는 초대코드가 만들어집니다</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleGenerateQuestions}
              disabled={!file || questionTypes.length === 0 || isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? "문제 생성 중..." : "문제 생성 및 방 만들기"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
