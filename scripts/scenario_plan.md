# 테스트 시나리오 5개 계획표

## 1. 시나리오 목록 (확정 - 5개만 사용)

| meeting_id | 유형 | 길이 | 상태 |
|---|---|---|---|
| meeting_001 | 담당자 O, 마감일 O | 15초 | 대본·STT정답·Agent정답 완료, 녹음 완료 |
| meeting_002 | 담당자 O, 마감일 X | 15초 | 대본·STT정답·Agent정답 완료, 녹음 완료 |
| meeting_003 | 담당자 X, 마감일 O | 15초 | 대본·STT정답·Agent정답 완료, 녹음 완료 |
| meeting_004 | 애매한 지시 + 결정 vs 의견 혼합 | 30초 | 대본·STT정답·Agent정답 완료, 녹음 완료 |
| meeting_005 | 발언 충돌 (마감일 뒤집힘) | 30초 | 대본·STT정답·Agent정답 완료, 녹음 완료 |

※ 이 5개 외 추가 시나리오는 만들지 않음 (기존 20개 계획 폐기)

## 2. 확정된 대본 + 예상 정답

### meeting_001 — 담당자 O, 마감일 O
```
서연: 이번 주 발표 자료는 누가 정리할까요?
지원: 제가 할게요. 오늘 밤까지 초안 만들어볼게요.
서경: 좋아요. 그럼 내일 오전에 같이 확인하죠.
지원: 네, 알겠습니다. 오전 몇시가 좋을까요?
서연: 오전 10시에 회의하는거 어때요?
서경: 좋습니다. 내일 뵐게요.
```
예상 정답: task: 발표 자료 초안 작성 / assignee: 지원 / deadline: 오늘 밤 / needs_confirmation: false / decision: 내일 오전 10시에 확인 회의 진행

---

### meeting_002 — 담당자 O, 마감일 X
```
서경: 문서 정리는 누가 맡을래요?
서연: 제가 정리해볼게요.
지원: 그럼 저는 그동안 화면 쪽 준비할게요.
서경: 좋습니다.
```
예상 정답: task: 문서 정리 / assignee: 서연 / deadline: null / needs_confirmation: true

---

### meeting_003 — 담당자 X, 마감일 O
```
지원: 이건 이번 주 금요일까지는 끝내야 할 것 같아요.
서경: 맞아요, 다음 주 발표 전에 꼭 필요해요.
서연: 그럼 일단 급한 대로 진행해볼게요.
지원: 좋아요.
```
예상 정답: task: (명시 안 됨, "이것") / assignee: null / deadline: 금요일 / needs_confirmation: true

---

### meeting_004 — 애매한 지시 + 결정 vs 의견 혼합
```
서경: 이번 UI 디자인 톤은 어떻게 갈까요?
지원: 저는 개인적으로 좀 더 차분한 톤이 나을 것 같아요.
서연: 저는 그것도 괜찮은데, 너무 어두우면 접근성에 안 좋을 수도 있어요.
지원: 아, 그건 생각 못 했네요.
서경: 그럼 일단 지원이가 시안 두 개 정도 만들어볼래요?
지원: 네, 밝은 버전이랑 차분한 버전 둘 다 만들어볼게요.
서경: 좋아요. 그거 보고 다음 회의 때 정하죠.
```
예상 정답: task: UI 디자인 시안 2개 제작 (밝은 버전 + 차분한 버전) / assignee: 지원 / deadline: 명시 안 됨 / needs_confirmation: true

---

### meeting_005 — 발언 충돌
```
서연: 서경님이 맡으신 부분 A는 언제까지 가능하실거 같아요?
서경: 저 8월 20일이요.
지원: 그럼 저 그때부터 iOS 연동 시작하면 되겠네요.
서경: 아 잠깐만요, 테스트 데이터가 더 필요해서요. 22일로 늦춰질 것 같아요.
서연: 알겠습니다, 22일이요.
지원: 저는 그럼 22일 이후로 일정 잡을게요.
서경: 네, 그걸로 확정이요.
```
예상 정답: task: 서경이 맡은 A / assignee: 서경 / deadline: 8월 22일 (20일→22일 정정) / needs_confirmation: false

## 3. API 스키마 기준 필드명 (중요)

서경의 `/analyze` API 스키마(`AnalyzeRequest` / `ReviewedTranscriptSegment`) 기준으로 STT ground truth를 작성할 때는 아래 필드명을 그대로 써야 나중에 변환 없이 바로 넣어볼 수 있음.

| 필드명 | 타입 | 비고 |
|---|---|---|
| `segment_id` | string | |
| `text` | string | 최종(수정된) 텍스트 |
| `speaker` | string \| null | 최종(수정된) 화자 |
| `start_time` | number \| null | ⚠️ `start` 아님 |
| `end_time` | number \| null | ⚠️ `end` 아님 |
| `original_text` | string \| null | STT 원본 텍스트 |
| `original_speaker` | string \| null | STT 원본 화자 |
| `review_status` | string | "pending" / "confirmed" / "corrected" (enum, 이 3개뿐) |
| `user_edited` | boolean | |

최상위 요청 객체(`AnalyzeRequest`)는 `meeting_id`(string) + `reviewed_segments`(위 객체 배열) 구조.

Agent 정답(`meeting_XXX_agent.json`)은 `/analyze` 응답 스키마가 미공개라 확정 형식이 아님 — 자세한 내용은 README 참고.
