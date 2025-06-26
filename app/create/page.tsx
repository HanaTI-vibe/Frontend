"use client";

import type React from "react";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  FileText,
  Users,
  Brain,
  ArrowLeft,
  X,
  Loader2,
  BookOpen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CreateRoomPage() {
  const [file, setFile] = useState<File | null>(null);
  const [questionTypes, setQuestionTypes] = useState<string[]>([
    "multiple-choice",
  ]);
  const [questionCount, setQuestionCount] = useState("10");
  const [difficulty, setDifficulty] = useState("medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const router = useRouter();
  const [timeLimit, setTimeLimit] = useState("120");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
      } else {
        alert("PDF 파일만 업로드 가능합니다.");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        alert("PDF 파일만 업로드 가능합니다.");
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleQuestionTypeChange = (type: string, checked: boolean) => {
    if (checked) {
      setQuestionTypes([...questionTypes, type]);
    } else {
      setQuestionTypes(questionTypes.filter((t) => t !== type));
    }
  };

  const handleGenerateQuestions = async () => {
    if (!file || questionTypes.length === 0) return;

    setIsGenerating(true);
    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("questionTypes", JSON.stringify(questionTypes));
    formData.append("questionCount", questionCount);
    formData.append("difficulty", difficulty);
    formData.append("timeLimit", timeLimit);

    try {
      // Spring Boot 백엔드 서버로 요청
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_BASE_URL + "/api/generate-questions",
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("방 생성 성공:", data);
        router.push(`/room/${data.roomId}`);
      } else {
        const errorText = await response.text();
        console.error("방 생성 실패:", response.status, errorText);
        alert("방 생성에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (error) {
      console.error("Failed to generate questions:", error);
      alert(
        "서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인해주세요."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 animate-fade-in-up">
      {/* 숨겨진 파일 입력 */}
      <Input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8 animate-fade-in-down">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="mb-4 transform hover:scale-105 transition-all duration-300 hover:shadow-md"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            메인으로 돌아가기
          </Button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4 animate-scale-in">
              <div className="bg-blue-600 text-white p-3 rounded-lg animate-bounce-in">
                <BookOpen className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900">L2Q</h1>
            </div>
            <h2 className="text-2xl font-bold text-gray-700 mb-4 animate-fade-in-up animation-delay-200">
              새로운 퀴즈방 만들기
            </h2>
            <p className="text-lg text-gray-600 animate-fade-in-up animation-delay-400">
              강의자료를 업로드하고 AI가 생성한 문제로 친구들과 함께 퀴즈를 풀어보세요
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="animate-fade-in-left animation-delay-600 hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 animate-float" />
                PDF 업로드
              </CardTitle>
              <CardDescription>
                강의자료 PDF 파일을 업로드해주세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/50 ${
                  isDragOver
                    ? "border-blue-500 bg-blue-50 scale-105"
                    : file
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={openFileDialog}
              >
                {file ? (
                  <div className="space-y-2 animate-scale-in">
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-green-600 animate-bounce" />
                      <span className="font-medium text-green-700">
                        업로드 완료
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile();
                      }}
                      className="mt-2 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors duration-200"
                    >
                      <X className="w-4 h-4 mr-1" />
                      파일 제거
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <Upload className="w-12 h-12 text-gray-400 animate-float" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">
                        PDF 파일을 드래그하여 업로드하거나
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        클릭하여 파일을 선택하세요
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in-right animation-delay-800 hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 animate-float animation-delay-500" />
                문제 설정
              </CardTitle>
              <CardDescription>
                생성할 문제의 유형과 개수를 설정해주세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium">문제 유형</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 transform hover:scale-105 transition-transform duration-200">
                    <Checkbox
                      id="multiple-choice"
                      checked={questionTypes.includes("multiple-choice")}
                      onCheckedChange={(checked) =>
                        handleQuestionTypeChange("multiple-choice", checked as boolean)
                      }
                    />
                    <Label htmlFor="multiple-choice" className="text-sm">
                      객관식 (4지선다)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 transform hover:scale-105 transition-transform duration-200">
                    <Checkbox
                      id="short-answer"
                      checked={questionTypes.includes("short-answer")}
                      onCheckedChange={(checked) =>
                        handleQuestionTypeChange("short-answer", checked as boolean)
                      }
                    />
                    <Label htmlFor="short-answer" className="text-sm">
                      단답형
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="question-count" className="text-sm font-medium">
                  문제 개수
                </Label>
                <Select value={questionCount} onValueChange={setQuestionCount}>
                  <SelectTrigger className="transform focus:scale-105 transition-all duration-200">
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

              <div className="space-y-2">
                <Label htmlFor="difficulty" className="text-sm font-medium">
                  난이도
                </Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="transform focus:scale-105 transition-all duration-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">쉬움</SelectItem>
                    <SelectItem value="medium">보통</SelectItem>
                    <SelectItem value="hard">어려움</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time-limit" className="text-sm font-medium">
                  문제당 제한시간 (초)
                </Label>
                <Select value={timeLimit} onValueChange={setTimeLimit}>
                  <SelectTrigger className="transform focus:scale-105 transition-all duration-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60초</SelectItem>
                    <SelectItem value="90">90초</SelectItem>
                    <SelectItem value="120">120초</SelectItem>
                    <SelectItem value="150">150초</SelectItem>
                    <SelectItem value="180">180초</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-center animate-fade-in-up animation-delay-1000">
          <Button
            onClick={handleGenerateQuestions}
            disabled={!file || questionTypes.length === 0 || isGenerating}
            size="lg"
            className="px-12 py-6 text-lg font-semibold transform hover:scale-105 transition-all duration-300 hover:shadow-lg disabled:transform-none disabled:hover:scale-100"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                AI가 문제를 생성하는 중...
              </>
            ) : (
              <>
                <Brain className="w-6 h-6 mr-3" />
                퀴즈방 생성하기
              </>
            )}
          </Button>
        </div>

        {/* 생성 진행 모달 */}
        <Dialog open={isGenerating} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md animate-scale-in">
            <DialogHeader>
              <DialogTitle className="text-center">
                AI가 문제를 생성하고 있어요
              </DialogTitle>
              <DialogDescription className="text-center">
                업로드된 PDF를 분석하여 퀴즈를 만들고 있습니다.
                <br />
                잠시만 기다려주세요...
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  PDF 문서 분석 중...
                </p>
                <div className="flex justify-center space-x-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce animation-delay-200"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce animation-delay-400"></div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
