import { SetupGuide } from "@/components/setup-guide"

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">API 설정 가이드</h1>
          <p className="text-gray-600">무료 Google Gemini API로 AI 학습 플랫폼을 시작하세요!</p>
        </div>
        <SetupGuide />
      </div>
    </div>
  )
}
