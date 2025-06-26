"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, ArrowLeft, Loader2, BookOpen } from "lucide-react";

export default function JoinRoomPage() {
  const [inviteCode, setInviteCode] = useState("");
  const [userName, setUserName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setInviteCode(code.toUpperCase());
    }
  }, [searchParams]);

  const handleJoinRoom = async () => {
    if (!inviteCode.trim() || !userName.trim()) {
      setError("초대코드와 이름을 모두 입력해주세요.");
      return;
    }

    setIsJoining(true);
    setError("");

    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/rooms/by-code?code=${inviteCode.trim()}`;
      console.log("=== 방 찾기 API 호출 ===");
      console.log("API URL:", apiUrl);
      console.log("초대코드:", inviteCode.trim());
      console.log("환경변수 API_BASE_URL:", process.env.NEXT_PUBLIC_API_BASE_URL);
      
      // 초대코드로 방 찾기 - 백엔드 API와 맞는 엔드포인트 사용
      const roomResponse = await fetch(apiUrl);

      console.log("응답 상태:", roomResponse.status);
      console.log("응답 OK:", roomResponse.ok);

      if (roomResponse.ok) {
        const roomData = await roomResponse.json();
        console.log("방 찾기 성공:", roomData);
        
        // 방이 있으면 해당 방으로 이동
        const redirectUrl = `/room/${roomData.roomId}?name=${encodeURIComponent(userName.trim())}`;
        console.log("리다이렉트 URL:", redirectUrl);
        router.push(redirectUrl);
      } else {
        const errorText = await roomResponse.text();
        console.log("방 찾기 실패 응답:", errorText);
        setError("유효하지 않은 초대코드입니다.");
      }
    } catch (error) {
      console.error("방 찾기 오류:", error);
      setError("방 입장 중 오류가 발생했습니다.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-4 animate-fade-in-up">
      <div className="w-full max-w-md space-y-6">
        {/* 헤더 */}
        <div className="text-center animate-fade-in-down">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="absolute top-4 left-4 transform hover:scale-105 transition-all duration-300 hover:shadow-md"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            메인으로
          </Button>
          
          <div className="flex items-center justify-center gap-3 mb-4 animate-scale-in">
            <div className="bg-green-600 text-white p-3 rounded-lg animate-bounce-in">
              <BookOpen className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">L2Q</h1>
          </div>
          <h2 className="text-xl font-bold text-gray-700 mb-2 animate-fade-in-up animation-delay-200">
            퀴즈방 입장
          </h2>
          <p className="text-gray-600 animate-fade-in-up animation-delay-400">
            초대코드를 입력하고 친구들과 함께 퀴즈를 풀어보세요
          </p>
        </div>

        {/* 입장 폼 */}
        <Card className="animate-scale-in animation-delay-600 hover-lift">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Users className="w-5 h-5 animate-float" />
              방 입장하기
            </CardTitle>
            <CardDescription>
              초대코드와 닉네임을 입력해주세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite-code" className="text-sm font-medium">
                초대코드
              </Label>
              <Input
                id="invite-code"
                placeholder="예: ABC123"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center text-lg font-mono tracking-wider transform focus:scale-105 transition-all duration-300 focus:shadow-lg"
              />
              <p className="text-xs text-gray-500">
                6자리 영문+숫자 조합의 초대코드를 입력하세요
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-name" className="text-sm font-medium">
                닉네임
              </Label>
              <Input
                id="user-name"
                placeholder="닉네임을 입력하세요"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                maxLength={20}
                className="transform focus:scale-105 transition-all duration-300 focus:shadow-lg"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !isJoining) {
                    handleJoinRoom();
                  }
                }}
              />
              <p className="text-xs text-gray-500">
                방에서 사용할 닉네임을 입력하세요 (최대 20자)
              </p>
            </div>

            <Button
              onClick={handleJoinRoom}
              disabled={!inviteCode.trim() || !userName.trim() || isJoining}
              className="w-full bg-green-600 hover:bg-green-700 transform hover:scale-105 transition-all duration-300 hover:shadow-lg disabled:transform-none"
              size="lg"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  입장 중...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5 mr-2" />
                  방 입장하기
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 도움말 */}
        <Card className="bg-blue-50 border-blue-200 animate-fade-in-up animation-delay-800 hover-lift">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <div className="text-blue-600 font-medium text-sm">💡 도움말</div>
              <p className="text-blue-700 text-sm">
                친구가 공유한 6자리 초대코드를 입력하면
                <br />
                바로 퀴즈방에 참여할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
