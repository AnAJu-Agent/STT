# STT & Agent 평가용 데이터셋

## 목적
Whisper / 서경의 Agent를 사람이 만든 정답(Ground Truth)과 비교 평가하기 위한 5개 회의 음성 + 정답 세트.

## 현재 진행 상황
- `meeting_001` ~ `meeting_005`: 대본, STT 정답, Agent 정답, 녹음 모두 완료 (STT 정답의 타임스탬프는 임시값 - 실제 녹음 파일 기준으로 재확인 필요)
- 이 5개 외 추가 시나리오는 계획하지 않음

## 폴더 구조
```
stt_evaluation_dataset/
├── audio/              # 녹음 파일 (meeting_001.m4a ...)
├── ground_truth/       # 사람이 직접 작성한 정답
│   ├── meeting_XXX_stt.json    # 발화문·화자·타임스탬프 정답
│   └── meeting_XXX_agent.json  # task/assignee/deadline/decision 정답
├── results/
│   ├── whisper/         # Whisper 실행 결과
│   └── agent/
│       ├── prompt_v1/   # 서경 Agent 프롬프트 v1 결과
│       └── prompt_v2/   # 서경 Agent 프롬프트 v2 결과
├── scripts/
│   ├── scenario_plan.md  # 5개 시나리오 대본 + 예상 정답
│   └── run_whisper.py    # audio/ 파일을 Whisper로 돌려 results/whisper/에 저장
└── metadata.csv          # 회의별 화자 수/잡음/시나리오 유형
```

## 작업 순서
1. `scripts/scenario_plan.md`에서 확정된 5개 시나리오 대본 확인
2. 녹음 → `audio/`에 저장 (완료)
3. 녹음 들으면서 `ground_truth/meeting_XXX_stt.json`의 타임스탬프를 실제 값으로 갱신
4. `ground_truth/meeting_XXX_agent.json`은 이미 작성됨 (task·assignee·deadline·decision·근거)
5. `python scripts/run_whisper.py` 실행 → `results/whisper/`에 결과 저장
6. `results/whisper/`와 `ground_truth/`를 문장별로 비교해 오류 기록
7. 서경 Agent 결과는 `results/agent/prompt_v1/`, `prompt_v2/`에 버전별로 저장

## 원칙
- ground_truth 파일은 사람이 직접 검증한 것만 넣는다 (AI 결과 절대 섞지 않기)
- segment_id와 timestamp는 STT와 Agent 정답 파일 사이에서 동일하게 유지되어야 한다
- 같은 회의라도 STT 결과가 바뀌면 새 파일로 저장하고 기존 결과는 지우지 않는다 (비교 이력 보존)

따라서 `meeting_XXX_agent.json`에 쓰는 `task`, `assignee`, `deadline`, `decision`, `needs_confirmation` 등의 필드명은 서연이 전달받은 예시 문서에서 가져온 **추정 형식**이며, 다음 필드는 **API 스키마에 근거가 없어 제외**한다:
- `deliverable` — 초기 버전에서 썼으나 실제 스키마에 없어 삭제함

서경한테 `/analyze` 응답 스키마를 받으면 이 섹션과 `meeting_XXX_agent.json` 형식을 다시 맞춰야 함.
