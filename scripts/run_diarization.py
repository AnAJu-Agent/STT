"""
audio/ 폴더의 녹음 파일에 pyannote로 화자 분리를 돌리고,
이미 만들어둔 results/whisper/meeting_XXX.json의 speaker 필드를 채워서
results/whisper_diarized/meeting_XXX.json으로 저장한다.

실행 전 준비:
    1) results/whisper/ 안에 run_whisper.py로 만든 결과가 이미 있어야 함
    2) 아래 HF_TOKEN 자리에 hf_로 시작하는 Hugging Face 토큰 붙여넣기
    3) pip install pyannote.audio 설치 완료 상태여야 함

실행:
    python scripts/run_diarization.py
"""

import json
import os
from pyannote.audio import Pipeline

# ↓↓↓ 여기에 복사해둔 hf_로 시작하는 토큰을 붙여넣기 ↓↓↓
HF_TOKEN = "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"

AUDIO_DIR = "audio"
WHISPER_DIR = "results/whisper"
OUTPUT_DIR = "results/whisper_diarized"

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("화자분리 모델 불러오는 중... (처음엔 다운로드 때문에 시간이 좀 걸림)")
pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    token=HF_TOKEN
)


def assign_speaker(seg_start, seg_end, diarization):
    """문장의 시간 구간과 가장 많이 겹치는 화자를 찾아서 반환"""
    best_speaker = None
    best_overlap = 0.0

    # pyannote 버전에 따라 결과 형식이 다름 - 둘 다 지원
    if hasattr(diarization, "itertracks"):
        # 예전 방식 (Annotation 객체)
        tracks = [(turn, speaker) for turn, _, speaker in diarization.itertracks(yield_label=True)]
    else:
        # 새 방식 (DiarizeOutput 객체)
        tracks = list(diarization.speaker_diarization)

    for turn, speaker in tracks:
        overlap = min(seg_end, turn.end) - max(seg_start, turn.start)
        if overlap > best_overlap:
            best_overlap = overlap
            best_speaker = speaker
    return best_speaker


audio_files = sorted(
    f for f in os.listdir(AUDIO_DIR)
    if f.lower().endswith((".m4a", ".mp3", ".wav", ".mp4", ".aac"))
)

for filename in audio_files:
    meeting_id = os.path.splitext(filename)[0]
    audio_path = os.path.join(AUDIO_DIR, filename)
    whisper_path = os.path.join(WHISPER_DIR, f"{meeting_id}.json")

    if not os.path.exists(whisper_path):
        print(f"[{meeting_id}] {whisper_path} 없음 - 먼저 run_whisper.py를 실행하세요. 건너뜀.")
        continue

    print(f"[{meeting_id}] 화자분리 진행 중...")
    # 우리 회의는 항상 3명(서연/지원/서경)이라 화자 수를 미리 알려주면 정확도가 크게 올라감
    diarization = pipeline(audio_path, num_speakers=3)

    with open(whisper_path, encoding="utf-8") as f:
        data = json.load(f)

    for seg in data["reviewed_segments"]:
        speaker = assign_speaker(seg["start_time"], seg["end_time"], diarization)
        # pyannote는 SPEAKER_00, SPEAKER_01 같은 이름을 붙임 - 사람 이름은 나중에 검토 화면에서 수동 매핑
        seg["speaker"] = speaker
        seg["original_speaker"] = speaker

    output_path = os.path.join(OUTPUT_DIR, f"{meeting_id}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"  -> 저장 완료: {output_path}")

print("전체 완료.")
