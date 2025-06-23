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
  const [timeLimit, setTimeLimit] = useState("30");
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
        "http://localhost:8080/api/generate-questions",
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            메인으로 돌아가기
          </Button>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              새로운 학습방 만들기
            </h1>
            <p className="text-lg text-gray-600">
              강의자료를 업로드하고 AI가 생성한 문제로 친구들과 함께 공부하세요
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                PDF 업로드
              </CardTitle>
              <CardDescription>
                강의자료 PDF 파일을 업로드해주세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                    isDragOver
                      ? "border-blue-500 bg-blue-50"
                      : file
                      ? "border-green-500 bg-green-50"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {file ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <FileText className="w-12 h-12 text-green-500 mb-2" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-700">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={removeFile}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          파일 삭제
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={openFileDialog}
                        >
                          다른 파일 선택
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload
                        className={`w-12 h-12 mx-auto mb-4 ${
                          isDragOver ? "text-blue-500" : "text-gray-400"
                        }`}
                      />
                      <div className="space-y-2">
                        <p
                          className={`text-sm ${
                            isDragOver ? "text-blue-600" : "text-gray-600"
                          }`}
                        >
                          {isDragOver
                            ? "PDF 파일을 여기에 놓으세요"
                            : "PDF 파일을 드래그하여 업로드하거나"}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={openFileDialog}
                        >
                          파일 선택하기
                        </Button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        PDF 파일만 업로드 가능합니다
                      </p>
                    </div>
                  )}
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
              <CardDescription>
                생성할 문제의 유형과 설정을 선택해주세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  문제 유형
                </Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="multiple-choice"
                      checked={questionTypes.includes("multiple-choice")}
                      onCheckedChange={(checked) =>
                        handleQuestionTypeChange(
                          "multiple-choice",
                          checked as boolean
                        )
                      }
                    />
                    <Label htmlFor="multiple-choice">객관식</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="short-answer"
                      checked={questionTypes.includes("short-answer")}
                      onCheckedChange={(checked) =>
                        handleQuestionTypeChange(
                          "short-answer",
                          checked as boolean
                        )
                      }
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
            <CardDescription>
              문제가 생성되면 친구들과 공유할 수 있는 초대코드가 만들어집니다
            </CardDescription>
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

      {/* 로딩 모달 */}
      <Dialog open={isGenerating} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-center">문제 생성 중...</DialogTitle>
            <DialogDescription asChild>
              <div className="text-center py-4">
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                  <p>AI가 PDF 내용을 분석하여 문제를 생성하고 있습니다.</p>
                  <p className="text-sm text-gray-500">
                    잠시만 기다려주세요...
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
