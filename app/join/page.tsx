"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Users, AlertCircle } from "lucide-react"

export default function JoinRoomPage() {
  const [inviteCode, setInviteCode] = useState("")
  const [userName, setUserName] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get("code")
    if (code) {
      setInviteCode(code.toUpperCase())
    }
  }, [searchParams])

  const handleJoinRoom = async () => {
    if (!inviteCode.trim() || !userName.trim()) return

    setIsJoining(true)
    setError("")

    try {
      // 초대코드로 roomId 조회
      const response = await fetch(`/api/rooms/by-code?code=${inviteCode.trim()}`)

      if (response.ok) {
        const { roomId } = await response.json()
        router.push(`/room/${roomId}?name=${encodeURIComponent(userName.trim())}`)
      } else {
        setError("유효하지 않은 초대코드입니다.")
      }
    } catch (error) {
      setError("방 입장 중 오류가 발생했습니다.")
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            메인으로 돌아가기
          </Button>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8" />
            </div>
            <CardTitle>학습방 입장</CardTitle>
            <CardDescription>초대코드와 이름을 입력하고 친구들과 함께 공부하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="invite-code">초대코드</Label>
              <Input
                id="invite-code"
                placeholder="예: ABC123"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center text-lg font-mono"
              />
            </div>

            <div>
              <Label htmlFor="user-name">이름</Label>
              <Input
                id="user-name"
                placeholder="이름을 입력하세요"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button
              onClick={handleJoinRoom}
              disabled={!inviteCode.trim() || !userName.trim() || isJoining}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {isJoining ? "입장 중..." : "방 입장하기"}
            </Button>

            <div className="text-center text-sm text-gray-500">
              <p>초대코드는 방을 만든 친구에게 받을 수 있습니다</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
