const DEMO_MEETING = "meeting_001";
const state = JSON.parse(localStorage.getItem("stt-demo-state") || "null") || {
  meetingId: DEMO_MEETING,
  document: null,
  transcript: null,
  selectedSegmentId: "seg_002",
  majorTopic: "내 할 일",
  minorTopic: "해야 할 일",
};

state.majorTopic ||= "내 할 일";
state.minorTopic ||= "해야 할 일";

const fallbackTranscript = {
  meeting_id: DEMO_MEETING,
  reviewed_segments: [
    {
      segment_id: "seg_001",
      text: "이번 주 발표 자료는 누가 정리할까요?",
      speaker: "SPEAKER_01",
      start_time: 0,
      end_time: 3.6,
    },
    {
      segment_id: "seg_002",
      text: "제가 할게요. 오늘 밤까지 초안 만들어볼게요.",
      speaker: "SPEAKER_00",
      start_time: 3.6,
      end_time: 7.28,
    },
    {
      segment_id: "seg_003",
      text: "좋아요. 그럼 내일 오전에 같이 확인하죠.",
      speaker: "SPEAKER_00",
      start_time: 7.28,
      end_time: 11.36,
    },
    {
      segment_id: "seg_004",
      text: "네, 알겠습니다. 오전 몇 시가 좋을까요?",
      speaker: "SPEAKER_00",
      start_time: 11.36,
      end_time: 14.76,
    },
    {
      segment_id: "seg_005",
      text: "오전 10시에 회의하는 것 같아요?",
      speaker: "SPEAKER_00",
      start_time: 14.76,
      end_time: 17.3,
    },
    {
      segment_id: "seg_006",
      text: "좋습니다. 내일 뵐게요.",
      speaker: "SPEAKER_00",
      start_time: 17.3,
      end_time: 20.3,
    },
  ],
};

const fallbackDocument = {
  id: DEMO_MEETING,
  tasks: [
    {
      task: "발표 자료 초안 작성",
      assignee: "지원",
      deadline: "오늘 밤",
      status: "진행 중",
      needs_confirmation: false,
      evidence: { segment_id: "seg_002", start_time: 3.1, end_time: 6.5 },
    },
  ],
  decisions: [
    {
      content: "발표 자료 확인 회의를 내일 오전 10시에 진행",
      evidence: { segment_id: "seg_006", start_time: 15.7, end_time: 17.5 },
    },
  ],
  discussions: [
    {
      content: "발표 자료를 누가 정리할지 논의",
      evidence: { segment_id: "seg_001", start_time: 0, end_time: 3.6 },
    },
  ],
};

function persistState() {
  localStorage.setItem("stt-demo-state", JSON.stringify(state));
}

async function loadMeetingData() {
  if (!state.transcript) {
    try {
      state.transcript = await fetch(
        `../ground_truth/${state.meetingId}_stt.json`,
      ).then((response) => response.json());
    } catch (error) {
      state.transcript = fallbackTranscript;
    }
  }
  if (!state.document) {
    try {
      state.document = await callApi("/analyze", {
        meeting_id: state.meetingId,
        reviewed_transcript: state.transcript.reviewed_segments,
      });
    } catch (error) {
      try {
        state.document = await fetch(
          `../ground_truth/${state.meetingId}_agent.json`,
        ).then((response) => response.json());
      } catch (fallbackError) {
        state.document = fallbackDocument;
      }
    }
  }
  persistState();
  renderDataDrivenPage();
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

function findSegment(segmentId) {
  return state.transcript?.reviewed_segments?.find(
    (segment) => segment.segment_id === segmentId,
  );
}

function playEvidence(segmentId) {
  state.selectedSegmentId = segmentId;
  persistState();
  const segment = findSegment(segmentId);
  const audio = document.querySelector("audio");
  if (audio && segment) {
    audio.currentTime = segment.start_time;
    audio.play().catch(() => {});
  } else if (!audio) {
    window.location.href = "step-09-audio.html";
    return;
  }
  const status = document.querySelector("[data-audio-status]");
  if (status && segment)
    status.textContent = `${segment.start_time.toFixed(1)}초부터 재생 중 · ${segment.text}`;
}

function renderDataDrivenPage() {
  const audio = document.querySelector("audio");
  if (audio) audio.src = `../audio/${state.meetingId}.m4a`;
  const task = state.document?.tasks?.[0];
  const hierarchyTitle = document.querySelector("[data-hierarchy-title]");
  if (hierarchyTitle)
    hierarchyTitle.textContent = `${state.majorTopic} · ${state.minorTopic}`;
  const detailCards = document.querySelectorAll("[data-detail-topic]");
  if (detailCards.length) {
    let visibleCardCount = 0;
    detailCards.forEach((card) => {
      const isSelected = card.dataset.detailTopic === state.minorTopic;
      card.hidden = !isSelected;
      if (isSelected) visibleCardCount += 1;
    });
    const detailList = document.querySelector(".detail-list");
    if (detailList && visibleCardCount === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "detail-empty";
      emptyState.textContent = `${state.minorTopic}에 해당하는 항목이 없습니다.`;
      detailList.append(emptyState);
    }
  }
  const taskTitle = document.querySelector("[data-task-title]");
  if (taskTitle && task) taskTitle.textContent = task.task;
  const assignee = document.querySelector("[data-assignee]");
  if (assignee && task) assignee.textContent = `담당자: ${task.assignee}`;
  const deadline = document.querySelector("[data-deadline]");
  if (deadline && task) deadline.textContent = `마감: ${task.deadline}`;
  const evidenceButtons = document.querySelectorAll("[data-evidence-id]");
  evidenceButtons.forEach((button) =>
    button.addEventListener("click", () =>
      playEvidence(button.dataset.evidenceId),
    ),
  );
}

function callApi(path, body) {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((response) => {
    if (!response.ok) throw new Error(`API ${response.status}`);
    return response.json();
  });
}

async function submitQuestion(input, answerBox) {
  const question = input.value.trim();
  if (!question) return;
  answerBox.hidden = false;
  answerBox.textContent = "답변을 준비하고 있습니다...";
  try {
    const answer = await callApi("/ask", {
      document: state.document,
      transcript: state.transcript,
      question,
    });
    answerBox.innerHTML = `<strong>${answer.answer || answer.content || "답변을 받았습니다."}</strong>`;
    (answer.evidence_segment_ids || []).forEach((id) => {
      const segment = findSegment(id);
      if (segment) {
        const evidenceText = document.createElement("p");
        evidenceText.textContent = `근거: ${segment.text}`;
        answerBox.append(evidenceText);
      }
      const button = document.createElement("button");
      button.className = "ghost-link";
      button.textContent = "이 근거 듣기";
      button.addEventListener("click", () => playEvidence(id));
      answerBox.append(button);
    });
  } catch (error) {
    const task = state.document?.tasks?.[0];
    const segment = task?.evidence?.segment_id
      ? findSegment(task.evidence.segment_id)
      : null;
    answerBox.innerHTML = `<strong>${task?.task || "등록된 업무"}</strong><p>${task?.assignee || "담당자 미정"} 담당 · ${task?.deadline || "마감일 미정"}</p>${segment ? `<p>근거: ${segment.text}</p>` : ""}`;
    const button = document.createElement("button");
    button.className = "ghost-link";
    button.textContent = "이 근거 듣기";
    button.addEventListener("click", () =>
      playEvidence(task?.evidence?.segment_id || "seg_002"),
    );
    answerBox.append(button);
  }
}

const topicButtons = document.querySelectorAll(".topic-btn");
const subtopicButtons = document.querySelectorAll(".subtopic-btn");

for (const button of topicButtons) {
  button.addEventListener("click", () => {
    topicButtons.forEach((item) =>
      item.classList.toggle("active", item === button),
    );
  });
}

for (const button of subtopicButtons) {
  button.classList.toggle(
    "active",
    (button.dataset.minorTopic || button.textContent.trim()) ===
      state.minorTopic,
  );
  button.addEventListener("click", () => {
    subtopicButtons.forEach((item) =>
      item.classList.toggle("active", item === button),
    );
    state.minorTopic = button.dataset.minorTopic || button.textContent.trim();
    persistState();
    window.location.href = "step-06-detail.html";
  });
}

document.querySelectorAll("[data-major-topic]").forEach((button) => {
  button.addEventListener("click", () => {
    state.majorTopic = button.dataset.majorTopic;
    state.minorTopic = "해야 할 일";
    persistState();
    window.location.href = "step-05-minor.html";
  });
});

document.querySelectorAll("[data-meeting]").forEach((button) => {
  button.addEventListener("click", () => {
    state.meetingId = button.dataset.meeting;
    state.document = null;
    state.transcript = null;
    persistState();
    window.location.href = "step-02-transcript.html";
  });
});

const editForm = document.querySelector("[data-feedback-form]");
if (editForm) {
  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const task = state.document?.tasks?.[0];
    const fields = new FormData(editForm);
    if (task) {
      task.assignee = fields.get("assignee") || task.assignee;
      task.deadline = fields.get("deadline") || task.deadline;
    }
    try {
      await callApi("/document-feedback", { document: state.document });
    } catch (error) {}
    persistState();
    editForm.querySelector("[data-feedback-status]").textContent =
      "수정 사항이 반영되었습니다.";
  });
}

const fileInput = document.querySelector('.file-picker input[type="file"]');
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        state.transcript = JSON.parse(reader.result);
        state.meetingId = state.transcript.meeting_id || "uploaded_meeting";
        state.document = null;
        persistState();
        window.location.href = "step-03-structure.html";
      } catch (error) {
        fileInput.closest("label").dataset.error =
          "JSON 파일을 읽지 못했습니다.";
      }
    });
    reader.readAsText(file);
  });
}

const questionInput = document.querySelector(".question-compose input");
const answerBox = document.querySelector("[data-answer]");
if (questionInput && answerBox) {
  document
    .querySelector(".send-btn")
    ?.addEventListener("click", () => submitQuestion(questionInput, answerBox));
  questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitQuestion(questionInput, answerBox);
  });
  document.querySelectorAll(".suggestion-pill").forEach((button) =>
    button.addEventListener("click", () => {
      questionInput.value = button.textContent.trim();
      submitQuestion(questionInput, answerBox);
    }),
  );
}

loadMeetingData();

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
  const prevPage = pageOrder[currentIndex - 1];
  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "back-nav-btn";
  backButton.setAttribute("aria-label", "이전 페이지");
  backButton.textContent = "‹";
  backButton.addEventListener("click", () => {
    window.location.href = prevPage;
  });

  phoneFrame.insertBefore(backButton, phoneFrame.firstChild);
}

const explicitNavButtons = document.querySelectorAll("[data-target]");
explicitNavButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.getAttribute("data-target");
    if (target) {
      window.location.href = target;
    }
  });
});

const backTargetButtons = document.querySelectorAll("[data-back-target]");
backTargetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.getAttribute("data-back-target");
    if (target) {
      window.location.href = target;
    }
  });
});

if (currentIndex >= 0 && currentIndex < pageOrder.length - 1) {
  const nextPage = pageOrder[currentIndex + 1];

  document.querySelectorAll("button").forEach((button) => {
    if (
      button.hasAttribute("data-target") ||
      button.hasAttribute("data-back-target") ||
      button.classList.contains("back-nav-btn") ||
      button.classList.contains("back-icon") ||
      button.classList.contains("send-btn") ||
      button.classList.contains("suggestion-pill") ||
      button.classList.contains("question-tab") ||
      button.hasAttribute("data-evidence-id") ||
      button.hasAttribute("data-meeting") ||
      button.type === "submit"
    ) {
      return;
    }

    button.addEventListener("click", () => {
      window.location.href = nextPage;
    });
  });
}
