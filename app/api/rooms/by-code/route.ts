// 초대코드로 roomId 조회하는 API
const rooms = new Map() // 실제로는 generate-questions에서 사용하는 동일한 Map 참조 필요

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")

  if (!code) {
    return new Response("Invite code is required", { status: 400 })
  }

  // 모든 룸에서 초대코드 매칭하는 룸 찾기
  for (const [roomId, room] of rooms.entries()) {
    if (room.inviteCode === code.toUpperCase()) {
      return Response.json({ roomId })
    }
  }

  return new Response("Room not found", { status: 404 })
}
