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
  button.addEventListener("click", () => {
    subtopicButtons.forEach((item) =>
      item.classList.toggle("active", item === button),
    );
  });
}

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
      button.classList.contains("question-tab")
    ) {
      return;
    }

    button.addEventListener("click", () => {
      window.location.href = nextPage;
    });
  });
}
