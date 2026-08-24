// ─── 1. API BASE URL ────────────────────────────────────────────────────────
const API_BASE_URL = "/api";

// ─── 2. 전역 상태 ─────────────────────────────────────────────────────────────
const DEMO_MEETING = "meeting_001";
const state = JSON.parse(localStorage.getItem("stt-demo-state") || "null") || {
  meetingId: DEMO_MEETING,
  document: null,
  transcript: null,
  selectedSegmentId: "seg_002",
  majorTopic: "내 할 일",
  minorTopic: "해야 할 일",
  speakerMap: {},   // { "SPEAKER_01": "서연", "SPEAKER_00": "지원", ... }
};

state.majorTopic ||= "내 할 일";
state.minorTopic ||= "해야 할 일";
state.speakerMap ||= {};

// ─── 3. Fallback 데이터 ────────────────────────────────────────────────────────
const fallbackTranscript = {
  meeting_id: DEMO_MEETING,
  reviewed_segments: [
    { segment_id: "seg_001", text: "이번 주 발표 자료는 누가 정리할까요?", speaker: "서연", start_time: 0, end_time: 3.6 },
    { segment_id: "seg_002", text: "제가 할게요. 오늘 밤까지 초안 만들어볼게요.", speaker: "지원", start_time: 3.6, end_time: 7.28 },
    { segment_id: "seg_003", text: "좋아요. 그럼 내일 오전에 같이 확인하죠.", speaker: "지원", start_time: 7.28, end_time: 11.36 },
    { segment_id: "seg_004", text: "네, 알겠습니다. 오전 몇 시가 좋을까요?", speaker: "지원", start_time: 11.36, end_time: 14.76 },
    { segment_id: "seg_005", text: "오전 10시에 회의하는 것 같아요?", speaker: "지원", start_time: 14.76, end_time: 17.3 },
    { segment_id: "seg_006", text: "좋습니다. 내일 뵐게요.", speaker: "지원", start_time: 17.3, end_time: 20.3 },
  ],
};

const fallbackDocument = {
  id: DEMO_MEETING,
  hierarchy: [
    { title: "내 할 일", subtopics: ["해야 할 일", "확인이 필요한 일", "완료한 일"] },
    { title: "마감일", subtopics: ["임박한 마감일", "마감일 미정"] },
    { title: "역할 분배", subtopics: ["팀원별 역할", "담당자 미정"] },
    { title: "결정된 내용", subtopics: ["확정된 결정"] },
    { title: "논의 중인 내용", subtopics: ["추가 논의 필요"] },
  ],
  tasks: [{
    task: "발표 자료 초안 작성", assignee: "지원", deadline: "오늘 밤",
    status: "진행 중", needs_confirmation: false,
    evidence: { segment_id: "seg_002", start_time: 3.1, end_time: 6.5 },
  }],
  decisions: [{ content: "발표 자료 확인 회의를 내일 오전 10시에 진행", evidence: { segment_id: "seg_006", start_time: 15.7, end_time: 17.5 } }],
  discussions: [{ content: "발표 자료를 누가 정리할지 논의", evidence: { segment_id: "seg_001", start_time: 0, end_time: 3.6 } }],
};

// ─── 4. 상태 저장 ─────────────────────────────────────────────────────────────
function persistState() {
  localStorage.setItem("stt-demo-state", JSON.stringify(state));
}

// ─── 5. API 호출 (EC2) ─────────────────────────────────────────────────────────
function callApi(path, body) {
  return fetch(API_BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((res) => {
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  });
}

function callGet(path) {
  return fetch(API_BASE_URL + path).then((res) => {
    if (!res.ok) throw new Error(`GET ${res.status}`);
    return res.json();
  });
}

// ─── 6. Health Check ─────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    await callGet("/health");
  } catch (_) {
    const banner = document.createElement("div");
    banner.style.cssText =
      "position:fixed;top:0;left:0;right:0;background:#c0392b;color:#fff;text-align:center;padding:6px 12px;font-size:13px;z-index:9999;";
    banner.textContent = "⚠ 서버에 연결할 수 없습니다. 오프라인 데이터를 사용합니다.";
    document.body.prepend(banner);
  }
}

// ─── 7. 로딩 오버레이 ─────────────────────────────────────────────────────────
function showLoading(msg = "분석 중…") {
  let overlay = document.getElementById("loading-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "loading-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9998;";
    overlay.innerHTML = `<div style="background:#fff;border-radius:12px;padding:24px 32px;font-size:15px;font-weight:600;">${msg}</div>`;
    document.body.append(overlay);
  }
}
function hideLoading() {
  document.getElementById("loading-overlay")?.remove();
}

// ─── 8. 화자 매핑 ─────────────────────────────────────────────────────────────
/**
 * 화자 매핑을 state.speakerMap에 저장하고,
 * state.transcript.reviewed_segments의 speaker 필드를
 * SPEAKER_XX → 실제 이름으로 교체한다.
 */
function applyAndSaveSpeakerMap() {
  const speakerSelects = document.querySelectorAll("[data-speaker]");
  speakerSelects.forEach((select) => {
    state.speakerMap[select.dataset.speaker] = select.value;
  });

  if (state.transcript?.reviewed_segments) {
    state.transcript.reviewed_segments = state.transcript.reviewed_segments.map(
      (seg) => ({
        ...seg,
        speaker: state.speakerMap[seg.speaker] || state.speakerMap[seg.original_speaker] || seg.speaker,
      })
    );
  }
  persistState();
}

/** 화자 매핑에 따라 화면의 화자 레이블만 업데이트 (UI 전용) */
function applyMappingToLabels() {
  const speakerSelects = document.querySelectorAll("[data-speaker]");
  const transcriptSpeakerLabels = document.querySelectorAll("[data-transcript-speaker]");
  speakerSelects.forEach((select) => {
    transcriptSpeakerLabels.forEach((label) => {
      if (label.dataset.transcriptSpeaker === select.dataset.speaker) {
        label.textContent = select.value;
      }
    });
  });
}

/** step-02에서 STT JSON의 화자 목록으로 select 옵션을 동적으로 채운다 */
function buildSpeakerMappingUI() {
  const mappingList = document.querySelector(".speaker-mapping-list");
  if (!mappingList || !state.transcript) return;

  // 세그먼트에서 고유 화자 목록 추출
  const uniqueSpeakers = [
    ...new Set(
      (state.transcript.reviewed_segments || []).map((s) => s.speaker || s.original_speaker)
    ),
  ].filter(Boolean);

  // 이름 후보: 참가자 칩에서 읽거나 기본값
  const nameCandidates = [
    ...(document.querySelectorAll(".participant-chip") || []),
  ].map((chip) => chip.textContent.trim());

  const defaultNames = nameCandidates.length ? nameCandidates : ["서연", "지원", "서경"];

  mappingList.replaceChildren();

  uniqueSpeakers.forEach((speakerCode, idx) => {
    const label = document.createElement("label");
    label.className = "speaker-mapping-row";

    const span = document.createElement("span");
    // e.g. SPEAKER_00 -> 화자 1
    span.textContent = `화자 ${idx + 1}`;

    const select = document.createElement("select");
    select.dataset.speaker = speakerCode;
    select.setAttribute("aria-label", `화자 ${idx + 1} 이름 선택`);

    const savedName = state.speakerMap[speakerCode];
    defaultNames.forEach((name, nameIdx) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (savedName ? name === savedName : nameIdx === idx % defaultNames.length) opt.selected = true;
      select.append(opt);
    });

    label.append(span, select);
    mappingList.append(label);
  });
}


// ─── 9. 데이터 로드 + /analyze 호출 ────────────────────────────────────────────
async function loadMeetingData() {
  // 9-1. STT transcript 로드
  if (!state.transcript) {
    try {
      state.transcript = await fetch(
        `../ground_truth/${state.meetingId}_stt.json`
      ).then((r) => r.json());
    } catch (_) {
      state.transcript = fallbackTranscript;
    }
  }

  // 9-2. 화자 매핑 UI 구성 (step-02 전용)
  buildSpeakerMappingUI();

  // 9-3. /analyze 호출 (문서가 없을 때만)
  if (!state.document) {
    showLoading("AI가 회의를 분석하는 중…");
    try {
      // 화자 매핑이 이미 적용된 reviewed_segments 전송
      const segments = state.transcript.reviewed_segments || [];
      state.document = await callApi("/analyze", {
        meeting_id: state.meetingId,
        reviewed_segments: segments,
      });
    } catch (_) {
      // fallback: ground_truth agent JSON
      try {
        state.document = await fetch(
          `../ground_truth/${state.meetingId}_agent.json`
        ).then((r) => r.json());
      } catch (__) {
        state.document = fallbackDocument;
      }
    } finally {
      hideLoading();
    }
  }

  persistState();
  renderDataDrivenPage();

  // 오디오 타임스탬프 초기화
  const audio = document.querySelector("audio");
  if (audio && state.selectedSegmentId) {
    const segment = findSegment(state.selectedSegmentId);
    if (segment) {
      audio.currentTime = segment.start_time;
      const status = document.querySelector("[data-audio-status]");
      if (status)
        status.textContent = `${segment.start_time.toFixed(1)}초부터 선택됨 · ${segment.text}`;
    }
  }
}

// ─── 10. 세그먼트 검색 ────────────────────────────────────────────────────────
function findSegment(segmentId) {
  return state.transcript?.reviewed_segments?.find(
    (s) => s.segment_id === segmentId
  );
}

// ─── 11. 오디오 재생 ─────────────────────────────────────────────────────────
function playEvidence(segmentId) {
  state.selectedSegmentId = segmentId;
  persistState();
  const segment = findSegment(segmentId);
  const audio = document.querySelector("audio");
  if (audio && segment) {
    audio.currentTime = segment.start_time;
    audio.play().catch(() => { });
  } else if (!audio) {
    window.location.href = "step-09-audio.html";
    return;
  }
  const status = document.querySelector("[data-audio-status]");
  if (status && segment)
    status.textContent = `${segment.start_time.toFixed(1)}초부터 재생 중 · ${segment.text}`;
}

// ─── 12. 계층 구조 파싱 ────────────────────────────────────────────────────────
function getItemText(item, fallback) {
  if (typeof item === "string") return item;
  return item?.title || item?.name || item?.label || item?.text || item?.content || fallback;
}
function getChildren(item) {
  return item?.subtopics || item?.children || item?.minor_topics || item?.minorTopics || [];
}
function getHierarchy() {
  const source =
    state.document?.hierarchy ||
    state.document?.semantic_structure ||
    state.document?.structure;
  const majorItems = Array.isArray(source)
    ? source
    : source?.major_topics ||
    source?.majorTopics ||
    state.document?.topics ||
    state.document?.major_topics ||
    fallbackDocument.hierarchy;
  return majorItems.map((major, i) => ({
    title: getItemText(major, `대주제 ${i + 1}`),
    subtopics: getChildren(major).map((minor, j) =>
      getItemText(minor, `중주제 ${j + 1}`)
    ),
    raw: major,
  }));
}

// ─── 13. H1/H2/H3 렌더링 ────────────────────────────────────────────────────
function renderHierarchy() {
  const hierarchy = getHierarchy();

  // step-03: 전체 계층 박스
  const hierarchyList = document.querySelector("[data-hierarchy-list]");
  if (hierarchyList) {
    hierarchyList.replaceChildren();
    hierarchy.forEach((major, index) => {
      const h1 = document.createElement("div");
      h1.className = "h1-box";
      h1.textContent = `H1 · 대주제 · ${major.title}`;
      hierarchyList.append(h1);

      if (major.subtopics.length) {
        const h2 = document.createElement("div");
        h2.className = "h2-box";
        h2.textContent = `H2 · 중주제 · ${major.subtopics.join(", ")}`;
        hierarchyList.append(h2);
      }

      if (index === 0 && major.subtopics[0]) {
        const h3 = document.createElement("div");
        h3.className = "h3-box";
        h3.textContent = `H3 · 소주제 · ${major.subtopics[0]}`;
        hierarchyList.append(h3);
      }
    });
  }

  // step-04: 대주제 버튼 목록
  const majorList = document.querySelector("[data-major-topic-list]");
  if (majorList) {
    majorList.replaceChildren();
    hierarchy.forEach((major) => {
      const button = document.createElement("button");
      button.className = "topic-btn";
      button.type = "button";
      button.dataset.majorTopic = major.title;
      button.textContent = major.title;
      button.classList.toggle("active", major.title === state.majorTopic);
      button.addEventListener("click", () => {
        state.majorTopic = major.title;
        state.minorTopic = major.subtopics[0] || "";
        persistState();
        window.location.href = "step-05-minor.html";
      });
      majorList.append(button);
    });
  }

  // step-05: 중주제 버튼 목록
  const minorList = document.querySelector("[data-minor-topic-list]");
  if (minorList) {
    const selectedMajor =
      hierarchy.find((m) => m.title === state.majorTopic) || hierarchy[0];
    minorList.replaceChildren();
    (selectedMajor?.subtopics || []).forEach((minor) => {
      const button = document.createElement("button");
      button.className = "subtopic-btn";
      button.type = "button";
      button.dataset.minorTopic = minor;
      button.textContent = minor;
      button.classList.toggle("active", minor === state.minorTopic);
      button.addEventListener("click", () => {
        state.minorTopic = minor;
        persistState();
        window.location.href = "step-06-detail.html";
      });
      minorList.append(button);
    });
  }
}

// ─── 13.5 트랜스크립트 렌더링 ────────────────────────────────────────────────────
function renderTranscript() {
  const transcriptBox = document.querySelector(".transcript-box");
  if (!transcriptBox || !state.transcript) return;

  transcriptBox.replaceChildren();
  const segments = state.transcript.reviewed_segments || [];

  segments.forEach((seg, idx) => {
    const speakerCode = seg.speaker || seg.original_speaker;
    const currentName = state.speakerMap[speakerCode] || speakerCode;

    const tag = document.createElement("div");
    tag.className = "speaker-tag";
    tag.dataset.transcriptSpeaker = speakerCode;
    tag.textContent = currentName;

    const p = document.createElement("p");
    p.textContent = seg.text || seg.original_text;

    transcriptBox.append(tag, p);
  });

  const uniqueSpeakers = new Set(segments.map(s => s.speaker || s.original_speaker));
  const headingSpan = document.querySelector(".review-content-heading span");
  if (headingSpan) headingSpan.textContent = `총 ${uniqueSpeakers.size}명의 화자`;
}

// ─── 14. 페이지 공통 렌더링 ──────────────────────────────────────────────────
function renderDataDrivenPage() {
  // 오디오 src 동적 설정
  const audio = document.querySelector("audio");
  if (audio) audio.src = `../audio/${state.meetingId}.m4a`;

  renderHierarchy();
  renderTranscript();

  // task 정보
  const task = state.document?.tasks?.[0];
  const hierarchyTitle = document.querySelector("[data-hierarchy-title]");
  if (hierarchyTitle) hierarchyTitle.textContent = state.minorTopic || "소주제";

  const detailCards = document.querySelectorAll("[data-detail-topic]");
  if (detailCards.length) {
    let visibleCount = 0;
    detailCards.forEach((card) => {
      const isSelected = card.dataset.detailTopic === state.minorTopic;
      card.hidden = !isSelected;
      if (isSelected) visibleCount++;
    });
    if (visibleCount === 0) {
      const detailList = document.querySelector(".detail-list");
      if (detailList) {
        const empty = document.createElement("p");
        empty.className = "detail-empty";
        empty.textContent = `${state.minorTopic}에 해당하는 항목이 없습니다.`;
        detailList.append(empty);
      }
    }
  }

  if (task) {
    const taskTitle = document.querySelector("[data-task-title]");
    if (taskTitle) taskTitle.textContent = task.task;
    const assignee = document.querySelector("[data-assignee]");
    if (assignee) assignee.textContent = `담당자: ${task.assignee}`;
    const deadline = document.querySelector("[data-deadline]");
    if (deadline) deadline.textContent = `마감: ${task.deadline}`;
  }

  // 근거 버튼 이벤트
  document.querySelectorAll("[data-evidence-id]").forEach((btn) =>
    btn.addEventListener("click", () => playEvidence(btn.dataset.evidenceId))
  );
}

// ─── 15. /ask 질문 전송 ───────────────────────────────────────────────────────
// 스키마: { meeting_id: string, question: string, user_name?: string }
async function submitQuestion(input, answerBox) {
  const question = input.value.trim();
  if (!question) return;
  answerBox.hidden = false;
  answerBox.textContent = "답변을 준비하고 있습니다…";
  try {
    const answer = await callApi("/ask", {
      meeting_id: state.meetingId,
      question,
    });
    const answerText = answer.answer || answer.content || "답변을 받았습니다.";
    answerBox.innerHTML = `<strong>${answerText}</strong>`;
    (answer.evidence_segment_ids || []).forEach((id) => {
      const seg = findSegment(id);
      if (seg) {
        const p = document.createElement("p");
        p.textContent = `근거: ${seg.text}`;
        answerBox.append(p);
      }
      const btn = document.createElement("button");
      btn.className = "ghost-link";
      btn.textContent = "이 근거 듣기";
      btn.addEventListener("click", () => playEvidence(id));
      answerBox.append(btn);
    });
  } catch (_) {
    // fallback 답변
    const task = state.document?.tasks?.[0];
    const seg = task?.evidence?.segment_id ? findSegment(task.evidence.segment_id) : null;
    answerBox.innerHTML = `<strong>${task?.task || "등록된 업무"}</strong><p>${task?.assignee || "담당자 미정"} 담당 · ${task?.deadline || "마감일 미정"}</p>${seg ? `<p>근거: ${seg.text}</p>` : ""}`;
    const btn = document.createElement("button");
    btn.className = "ghost-link";
    btn.textContent = "이 근거 듣기";
    btn.addEventListener("click", () => playEvidence(task?.evidence?.segment_id || "seg_002"));
    answerBox.append(btn);
  }
}

// ─── 16. 정적 버튼 이벤트 (topic / subtopic) ─────────────────────────────────
const topicButtons = document.querySelectorAll(".topic-btn");
const subtopicButtons = document.querySelectorAll(".subtopic-btn");

for (const btn of topicButtons) {
  btn.addEventListener("click", () => {
    topicButtons.forEach((b) => b.classList.toggle("active", b === btn));
  });
}

for (const btn of subtopicButtons) {
  btn.classList.toggle(
    "active",
    (btn.dataset.minorTopic || btn.textContent.trim()) === state.minorTopic
  );
  btn.addEventListener("click", () => {
    subtopicButtons.forEach((b) => b.classList.toggle("active", b === btn));
    state.minorTopic = btn.dataset.minorTopic || btn.textContent.trim();
    persistState();
    window.location.href = "step-06-detail.html";
  });
}

document.querySelectorAll("[data-major-topic]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.majorTopic = btn.dataset.majorTopic;
    state.minorTopic = "해야 할 일";
    persistState();
    window.location.href = "step-05-minor.html";
  });
});

// ─── 17. 샘플 선택 (step-01) ─────────────────────────────────────────────────
document.querySelectorAll("[data-meeting]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.meetingId = btn.dataset.meeting;
    state.document = null;
    state.transcript = null;
    state.speakerMap = {};
    persistState();
    window.location.href = "step-02-transcript.html";
  });
});

// ─── 18. /document-feedback (step-07) ────────────────────────────────────────
// 스키마: { meeting_id, target_type: "todo", target_id?, field, original_value?, corrected_value?, review_status }
const editForm = document.querySelector("[data-feedback-form]");
if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const task = state.document?.tasks?.[0];
    const fields = new FormData(editForm);
    const newAssignee = fields.get("assignee") || task?.assignee;
    const newDeadline = fields.get("deadline") || task?.deadline;
    const statusEl = editForm.querySelector("[data-feedback-status]");
    const calls = [];
    if (task) {
      if (newAssignee !== task.assignee) {
        calls.push(callApi("/document-feedback", {
          meeting_id: state.meetingId,
          target_type: "todo",
          target_id: task.task || null,
          field: "assignee",
          original_value: task.assignee,
          corrected_value: newAssignee,
          review_status: "corrected",
        }));
      }
      if (newDeadline !== task.deadline) {
        calls.push(callApi("/document-feedback", {
          meeting_id: state.meetingId,
          target_type: "todo",
          target_id: task.task || null,
          field: "deadline",
          original_value: task.deadline,
          corrected_value: newDeadline,
          review_status: "corrected",
        }));
      }
      task.assignee = newAssignee;
      task.deadline = newDeadline;
    }
    try {
      if (calls.length) await Promise.all(calls);
      if (statusEl) statusEl.textContent = "수정 사항이 반영되었습니다.";
    } catch (_) {
      if (statusEl) statusEl.textContent = "오프라인 저장됨 (서버 미응답).";
    }
    persistState();
  });
}

// ─── 19. JSON 파일 업로드 + /stt-feedback (step-01) ──────────────────────────
// 스키마: { meeting_id, segment_id, reviewed_text?, reviewed_speaker?, review_status } × 세그먼트 수
const fileInput = document.querySelector('.file-picker input[type="file"]');
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", async () => {
      try {
        const parsed = JSON.parse(reader.result);
        state.transcript = parsed;
        state.meetingId = parsed.meeting_id || "uploaded_meeting";
        state.document = null;
        state.speakerMap = {};
        persistState();

        // /stt-feedback: 세그먼트별로 각각 전송 (fire-and-forget)
        (parsed.reviewed_segments || []).forEach((seg) => {
          callApi("/stt-feedback", {
            meeting_id: state.meetingId,
            segment_id: seg.segment_id,
            reviewed_text: seg.text || seg.original_text || null,
            reviewed_speaker: seg.speaker || seg.original_speaker || null,
            review_status: seg.review_status || "confirmed",
          }).catch(() => { });
        });

        window.location.href = "step-02-transcript.html";
      } catch (_) {
        fileInput.closest("label").dataset.error = "JSON 파일을 읽지 못했습니다.";
      }
    });
    reader.readAsText(file);
  });
}

// ─── 20. 화자 매핑 적용 버튼 (step-02) ───────────────────────────────────────
document.querySelector("[data-apply-speakers]")?.addEventListener("click", (e) => {
  e.stopImmediatePropagation();
  applyMappingToLabels();   // UI 즉시 반영
  applyAndSaveSpeakerMap(); // state에 저장
});

// ─── 21. 질문 전송 (step-08) ─────────────────────────────────────────────────
const questionInput = document.querySelector(".question-compose input");
const answerBox = document.querySelector("[data-answer]");
if (questionInput && answerBox) {
  document.querySelector(".send-btn")
    ?.addEventListener("click", () => submitQuestion(questionInput, answerBox));
  questionInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitQuestion(questionInput, answerBox);
  });
  document.querySelectorAll(".suggestion-pill").forEach((btn) =>
    btn.addEventListener("click", () => {
      questionInput.value = btn.textContent.trim();
      submitQuestion(questionInput, answerBox);
    })
  );
}

// ─── 22. 페이지 초기화 ────────────────────────────────────────────────────────
checkHealth();
loadMeetingData();

// ─── 23. 페이지 내비게이션 ────────────────────────────────────────────────────
const pageOrder = [
  "step-01-upload.html",
  "step-02-transcript.html",
  "step-03-structure.html",
  "step-04-major.html",
  "step-05-minor.html",
  "step-06-detail.html",
  "step-07-edit.html",
  "step-08-question.html",
  "step-09-audio.html",
];

const currentPage = window.location.pathname.split("/").pop();
const currentIndex = pageOrder.indexOf(currentPage);

const phoneFrame = document.querySelector(".phone-frame");
if (phoneFrame && currentIndex > 0) {
  phoneFrame.classList.add("has-back-nav");
  const prevPage = pageOrder[currentIndex - 1];
  const pageLabels = {
    "step-01-upload.html": "업로드",
    "step-02-transcript.html": "회의 내용 검토",
    "step-03-structure.html": "Semantic Structure",
    "step-04-major.html": "대주제",
    "step-05-minor.html": "중주제",
    "step-06-detail.html": "소주제 상세",
    "step-07-edit.html": "사용자 수정",
    "step-08-question.html": "질문 입력",
  };
  const backNav = document.createElement("div");
  backNav.className = "back-nav-wrap";
  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "back-nav-btn";
  backButton.setAttribute("aria-label", "이전 페이지");
  backButton.textContent = "‹";
  backButton.addEventListener("click", () => { window.location.href = prevPage; });
  const pageLabel = document.createElement("span");
  pageLabel.className = "back-nav-label";
  pageLabel.textContent = pageLabels[currentPage] || "현재 화면";
  backNav.append(backButton, pageLabel);
  phoneFrame.insertBefore(backNav, phoneFrame.firstChild);
}

// 명시적 data-target 버튼
document.querySelectorAll("[data-target]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-target");
    if (target) window.location.href = target;
  });
});

// data-back-target 버튼
document.querySelectorAll("[data-back-target]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-back-target");
    if (target) window.location.href = target;
  });
});

// 일반 버튼 → 다음 페이지 자동 이동
if (currentIndex >= 0 && currentIndex < pageOrder.length - 1) {
  const nextPage = pageOrder[currentIndex + 1];
  document.querySelectorAll("button").forEach((btn) => {
    if (
      btn.hasAttribute("data-target") ||
      btn.hasAttribute("data-back-target") ||
      btn.classList.contains("back-nav-btn") ||
      btn.classList.contains("back-icon") ||
      btn.classList.contains("send-btn") ||
      btn.classList.contains("suggestion-pill") ||
      btn.classList.contains("question-tab") ||
      btn.hasAttribute("data-evidence-id") ||
      btn.hasAttribute("data-meeting") ||
      btn.hasAttribute("data-apply-speakers") ||
      btn.classList.contains("apply-speakers-btn") ||
      btn.type === "submit"
    ) return;
    btn.addEventListener("click", () => { window.location.href = nextPage; });
  });
}
