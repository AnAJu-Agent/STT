"""
audio/ 폴더의 모든 녹음 파일을 Whisper로 STT 돌리고,
ground_truth와 동일한 필드명(segment_id/text/speaker/start_time/end_time)으로
results/whisper/ 폴더에 저장한다.

실행 전 준비:
    pip install -U openai-whisper --break-system-packages
    (ffmpeg가 없으면 추가 설치 필요: mac은 `brew install ffmpeg`)

실행:
    python scripts/run_whisper.py
"""

import whisper
import json
import os

AUDIO_DIR = "audio"
OUTPUT_DIR = "results/whisper"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# base 모델 기준 - 더 정확한 결과가 필요하면 "small"이나 "medium"으로 바꿔도 됨
# (모델이 커질수록 느려짐, GPU 없으면 small 이상은 꽤 오래 걸릴 수 있음)
model = whisper.load_model("base")

audio_files = sorted(
    f for f in os.listdir(AUDIO_DIR)
    if f.lower().endswith((".m4a", ".mp3", ".wav", ".mp4", ".aac"))
)

if not audio_files:
    print(f"'{AUDIO_DIR}' 폴더에 오디오 파일이 없습니다.")

for filename in audio_files:
    meeting_id = os.path.splitext(filename)[0]  # meeting_001.m4a -> meeting_001
    audio_path = os.path.join(AUDIO_DIR, filename)
    print(f"[{meeting_id}] 변환 중...")

    result = model.transcribe(audio_path, language="ko")

    reviewed_segments = []
    for i, seg in enumerate(result["segments"], start=1):
        text = seg["text"].strip()
        reviewed_segments.append({
            "segment_id": f"seg_{i:03d}",
            "text": text,
            "speaker": None,           # Whisper는 화자 분리를 지원하지 않음
            "start_time": round(seg["start"], 2),
            "end_time": round(seg["end"], 2),
            "original_text": text,
            "original_speaker": None,
            "review_status": "pending",
            "user_edited": False
        })

    output = {
        "meeting_id": meeting_id,
        "reviewed_segments": reviewed_segments
    }

    output_path = os.path.join(OUTPUT_DIR, f"{meeting_id}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  -> 저장 완료: {output_path}")

print("전체 완료.")
