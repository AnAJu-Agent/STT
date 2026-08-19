"""
audio/ 폴더의 녹음 파일을 CLOVA Speech API(화자분리 포함)로 돌려서
ground_truth와 동일한 필드명(segment_id/text/speaker/start_time/end_time)으로
results/clova/ 폴더에 저장한다.

실행 전 준비:
    1) CLOVA Speech 콘솔에서 Invoke URL과 Secret Key 발급 완료 상태여야 함
    2) 아래 INVOKE_URL, SECRET_KEY 자리에 값 붙여넣기
    3) pip install requests 설치 완료 상태여야 함

실행:
    python scripts/run_clova.py
"""

import json
import os
import requests

import os
from dotenv import load_dotenv

load_dotenv()

INVOKE_URL = os.getenv("CLOVA_INVOKE_URL")
SECRET_KEY = os.getenv("CLOVA_SECRET_KEY")


AUDIO_DIR = "audio"
OUTPUT_DIR = "results/clova"

os.makedirs(OUTPUT_DIR, exist_ok=True)

headers = {
    "Accept": "application/json;UTF-8",
    "X-CLOVASPEECH-API-KEY": SECRET_KEY,
}

# 우리 회의는 항상 3명(서연/지원/서경)이라 화자 수를 미리 알려주면 정확도가 올라감
params = {
    "language": "ko-KR",
    "completion": "sync",
    "diarization": {
        "enable": True,
        "speakerCountMin": 3,
        "speakerCountMax": 3,
    },
}

audio_files = sorted(
    f for f in os.listdir(AUDIO_DIR)
    if f.lower().endswith((".m4a", ".mp3", ".wav", ".mp4", ".aac"))
)

if not audio_files:
    print(f"'{AUDIO_DIR}' 폴더에 오디오 파일이 없습니다.")

for filename in audio_files:
    meeting_id = os.path.splitext(filename)[0]
    audio_path = os.path.join(AUDIO_DIR, filename)
    print(f"[{meeting_id}] Clova로 요청 중...")

    with open(audio_path, "rb") as f:
        files = {
            "media": f,
            "params": (None, json.dumps(params).encode("UTF-8"), "application/json"),
        }
        response = requests.post(
            INVOKE_URL + "/recognizer/upload",
            headers=headers,
            files=files,
        )

    if response.status_code != 200:
        print(f"  실패 (status {response.status_code}): {response.text[:300]}")
        continue

    result = response.json()
    segments_raw = result.get("segments", [])

    reviewed_segments = []
    for i, seg in enumerate(segments_raw, start=1):
        text = seg.get("textEdited") or seg.get("text", "")
        speaker_info = seg.get("speaker", {})
        speaker = speaker_info.get("label") if isinstance(speaker_info, dict) else None
        # Clova는 ms 단위로 시간을 줌 -> 초 단위로 변환
        start_ms = seg.get("start", 0)
        end_ms = seg.get("end", 0)

        reviewed_segments.append({
            "segment_id": f"seg_{i:03d}",
            "text": text,
            "speaker": speaker,
            "start_time": round(start_ms / 1000, 2),
            "end_time": round(end_ms / 1000, 2),
            "original_text": text,
            "original_speaker": speaker,
            "review_status": "pending",
            "user_edited": False,
        })

    output = {
        "meeting_id": meeting_id,
        "reviewed_segments": reviewed_segments,
    }

    output_path = os.path.join(OUTPUT_DIR, f"{meeting_id}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  -> 저장 완료: {output_path}")

print("전체 완료.")
