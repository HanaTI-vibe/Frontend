import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, Gift, Zap } from "lucide-react"

export function SetupGuide() {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-green-500" />
          무료 Google Gemini API 설정하기
        </CardTitle>
        <CardDescription>Google Gemini는 매월 무료 할당량이 넉넉해서 개인 프로젝트에 최적입니다!</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-800">무료 혜택</span>
          </div>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• 월 15 requests/minute 무료</li>
            <li>• 1M tokens/month 무료</li>
            <li>• PDF 분석 지원</li>
            <li>• 신용카드 불필요</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">설정 단계:</h3>
          <ol className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                1
              </span>
              <div>
                <Button variant="link" className="p-0 h-auto" asChild>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                    Google AI Studio <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
                에 접속하여 Google 계정으로 로그인
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span>"Create API Key" 버튼 클릭</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                3
              </span>
              <span>생성된 API 키 복사</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                4
              </span>
              <div>
                프로젝트 루트에 <code className="bg-gray-100 px-1 rounded">.env.local</code> 파일 생성하고 다음 추가:
                <div className="bg-gray-900 text-green-400 p-2 rounded mt-1 font-mono text-xs">
                  GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                5
              </span>
              <span>개발 서버 재시작 후 사용!</span>
            </li>
          </ol>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            💡 <strong>팁:</strong> Google Gemini는 한국어 지원이 뛰어나고 PDF 분석 성능도 우수합니다!
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
