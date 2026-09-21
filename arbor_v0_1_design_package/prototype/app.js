const chatPage = document.getElementById("chat-page");
const settingsPage = document.getElementById("settings-page");
const treeDrawer = document.getElementById("tree-drawer");
const backdrop = document.getElementById("drawer-backdrop");
const anchorChip = document.getElementById("anchor-chip");
const anchorTitle = document.getElementById("anchor-title");
const clearAnchor = document.getElementById("clear-anchor");
const input = document.getElementById("composer-input");
const sendBtn = document.getElementById("send-btn");

function showPage(name) {
  const isSettings = name === "settings";
  chatPage.classList.toggle("active", !isSettings);
  settingsPage.classList.toggle("active", isSettings);
  closeTree();
}

function openTree() {
  treeDrawer.classList.add("open");
  backdrop.classList.add("open");
}

function closeTree() {
  treeDrawer.classList.remove("open");
  backdrop.classList.remove("open");
}

function setAnchor(title, el) {
  document.querySelectorAll(".answer-section").forEach((item) => {
    item.classList.toggle("selected", item === el);
  });
  anchorTitle.textContent = title;
  anchorChip.classList.remove("hidden");
  input.focus();
}

function resetAnchor() {
  document.querySelectorAll(".answer-section").forEach((item) => {
    item.classList.remove("selected");
  });
  anchorTitle.textContent = "";
  anchorChip.classList.add("hidden");
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;

  if (action === "settings") showPage("settings");
  if (action === "chat") showPage("chat");
  if (action === "tree") openTree();
  if (action === "tree-close") closeTree();
  if (action === "theme") document.body.classList.toggle("dark");

  const section = event.target.closest(".answer-section");
  if (section) {
    setAnchor(section.dataset.anchor, section);
  }
});

clearAnchor.addEventListener("click", resetAnchor);

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    fakeSend();
  }

  if (event.key === "Escape") {
    resetAnchor();
  }
});

sendBtn.addEventListener("click", fakeSend);

function fakeSend() {
  const value = input.value.trim();
  if (!value) return;

  const branch = anchorTitle.textContent
    ? ` · from ${anchorTitle.textContent}`
    : "";

  const messages = document.querySelector(".messages");
  const article = document.createElement("article");
  article.className = "message user-message branch-message";
  article.innerHTML = `
    <div class="message-role">You${branch}</div>
    <div class="message-body"></div>
  `;
  article.querySelector(".message-body").textContent = value;
  messages.appendChild(article);

  const reply = document.createElement("article");
  reply.className = "message assistant-message";
  reply.innerHTML = `
    <div class="message-role">Arbor</div>
    <div class="assistant-intro">
      这是静态 UI 原型。正式版本会在这里调用当前 Provider，并把这次追问保存为新的 Conversation Node。
    </div>
    <button class="answer-section" data-anchor="继续深入">
      <span class="section-topline">
        <span class="section-title">继续深入</span>
        <span class="section-arrow">↗</span>
      </span>
      <span class="section-content">
        点击此模块可以继续体验 Anchor → Branch 的交互。
      </span>
    </button>
  `;
  messages.appendChild(reply);

  input.value = "";
  input.style.height = "auto";
  resetAnchor();

  requestAnimationFrame(() => {
    document.querySelector(".chat-scroll").scrollTo({
      top: document.querySelector(".chat-scroll").scrollHeight,
      behavior: "smooth",
    });
  });
}
