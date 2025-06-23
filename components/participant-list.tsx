import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Trophy } from "lucide-react"

interface Participant {
  id: string
  name: string
  score: number
  isReady: boolean
}

interface ParticipantListProps {
  participants: Participant[]
}

export function ParticipantList({ participants }: ParticipantListProps) {
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            참가자 ({participants.length}명)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{participant.name}</span>
                  {participant.isReady && (
                    <Badge variant="secondary" className="text-xs">
                      준비완료
                    </Badge>
                  )}
                </div>
                <Badge variant="outline">{participant.score}점</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            실시간 순위
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedParticipants.map((participant, index) => (
              <div
                key={participant.id}
                className={`flex items-center justify-between p-2 rounded ${
                  index === 0
                    ? "bg-yellow-100 border border-yellow-300"
                    : index === 1
                      ? "bg-gray-100 border border-gray-300"
                      : index === 2
                        ? "bg-orange-100 border border-orange-300"
                        : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold ${
                      index === 0
                        ? "text-yellow-600"
                        : index === 1
                          ? "text-gray-600"
                          : index === 2
                            ? "text-orange-600"
                            : "text-gray-500"
                    }`}
                  >
                    #{index + 1}
                  </span>
                  <span className="font-medium">{participant.name}</span>
                </div>
                <span className="font-bold">{participant.score}점</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
