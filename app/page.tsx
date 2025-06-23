"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Users, BookOpen, Zap, MessageCircle, ArrowRight } from "lucide-react"

export default function HomePage() {
  const [inviteCode, setInviteCode] = useState("")
  const router = useRouter()

  const handleJoinRoom = () => {
    if (inviteCode.trim()) {
      router.push(`/join?code=${inviteCode.trim().toUpperCase()}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-lg">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI 협업 학습</h1>
                <p className="text-sm text-gray-600">함께 공부하는 스마트 플랫폼</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* 메인 타이틀 */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            AI가 만든 문제로
            <br />
            <span className="text-blue-600">친구들과 함께 공부하세요</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            강의자료 PDF를 업로드하면 AI가 자동으로 문제를 생성하고, 실시간으로 친구들과 함께 풀 수 있습니다
          </p>
        </div>

        {/* 주요 기능 소개 */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="text-center">
            <CardHeader>
              <div className="bg-green-100 text-green-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <CardTitle>AI 문제 생성</CardTitle>
              <CardDescription>PDF 업로드만으로 객관식, 단답식, 주관식 문제 자동 생성</CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6" />
              </div>
              <CardTitle>실시간 협업</CardTitle>
              <CardDescription>친구들과 동시에 문제를 풀고 실시간으로 점수 경쟁</CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="bg-purple-100 text-purple-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-6 h-6" />
              </div>
              <CardTitle>실시간 채팅</CardTitle>
              <CardDescription>문제를 풀면서 친구들과 힌트 공유 및 토론</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* 메인 액션 */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* 방 생성하기 */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full -translate-y-16 translate-x-16"></div>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="bg-blue-600 text-white p-2 rounded-lg">
                  <Plus className="w-5 h-5" />
                </div>
                방 생성하기
              </CardTitle>
              <CardDescription>
                강의자료 PDF를 업로드하고 AI가 생성한 문제로 새로운 학습방을 만들어보세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  PDF 업로드 및 AI 문제 생성
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  문제 유형 및 난이도 설정
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  초대코드로 친구들 초대
                </div>
              </div>
              <Button onClick={() => router.push("/create")} className="w-full" size="lg">
                방 생성하기
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* 방 입장하기 */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-full -translate-y-16 translate-x-16"></div>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="bg-green-600 text-white p-2 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                방 입장하기
              </CardTitle>
              <CardDescription>친구가 공유한 초대코드를 입력하고 함께 문제를 풀어보세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="invite-code" className="text-sm font-medium">
                    초대코드 입력
                  </Label>
                  <Input
                    id="invite-code"
                    placeholder="예: ABC123"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
                    className="mt-1"
                    maxLength={6}
                  />
                </div>
                <p className="text-xs text-gray-500">초대코드는 6자리 영문+숫자 조합입니다</p>
              </div>
              <Button
                onClick={handleJoinRoom}
                disabled={!inviteCode.trim()}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                방 입장하기
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 통계 */}
        <div className="mt-16 text-center">
          <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
            <div>
              <div className="text-2xl font-bold text-blue-600">1000+</div>
              <div className="text-sm text-gray-600">생성된 문제</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">500+</div>
              <div className="text-sm text-gray-600">활성 사용자</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">50+</div>
              <div className="text-sm text-gray-600">동시 접속방</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
