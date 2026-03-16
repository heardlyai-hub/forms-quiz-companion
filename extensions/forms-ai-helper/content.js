const STYLE_ID = "forms-quiz-companion-style";

const style = `
.fqc-chip {
  position: relative;
  margin-top: 0.65rem;
  border-radius: 12px;
  padding: 0.4rem 0.75rem;
  background: rgba(248, 249, 250, 0.95);
  border: 1px solid rgba(218, 220, 224, 0.9);
  color: #1f1f1f;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.fqc-chip button {
  border: 1px solid rgba(218, 220, 224, 1);
  background: #ffffff;
  color: #1f1f1f;
  border-radius: 999px;
  padding: 0.3rem 0.8rem;
  font-size: 0.75rem;
  cursor: pointer;
}
.fqc-chip button:hover {
  background: #f1f3f4;
}
.fqc-chip .message {
  flex: 1;
  color: #5f6368;
}
.fqc-chip .message.success {
  color: #1a73e8;
}
.fqc-chip .message.error {
  color: #d93025;
}
`;

injectStyle();

document.addEventListener("DOMContentLoaded", enhanceQuestions);
const observer = new MutationObserver(() => {
  window.requestAnimationFrame(enhanceQuestions);
});
observer.observe(document.body, { childList: true, subtree: true });

taskOnVisible(() => enhanceQuestions());

function taskOnVisible(cb) {
  if (document.readyState === "complete") {
    cb();
  } else {
    window.addEventListener("load", cb, { once: true });
  }
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = style;
  document.head.appendChild(el);
}

function enhanceQuestions() {
  const blocks = document.querySelectorAll('div[role="listitem"]');
  blocks.forEach((block) => {
    if (block.dataset.fqcEnhanced) return;
    const question = extractQuestion(block);
    const optionData = collectOptionData(block);
    if (!question || !optionData.length) return;
    block.dataset.fqcEnhanced = "true";
    attachChip(block, question, optionData);
  });
}

function extractQuestion(block) {
  const heading = block.querySelector('[role="heading"], .M7eMe');
  if (heading?.textContent?.trim()) return heading.textContent.trim();
  const label = block.querySelector('.Qr7Oae');
  return label?.textContent?.trim() || "";
}

function collectOptionData(block) {
  const radios = block.querySelectorAll('[role="radio"], [role="checkbox"]');
  const options = [];
  const seen = new Set();
  radios.forEach((el) => {
    const text = (el.getAttribute("aria-label") || el.textContent || "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    options.push({ label: text, element: el });
  });
  if (options.length) return options;

  const paragraphs = block.querySelectorAll('div[dir="auto"]');
  paragraphs.forEach((p) => {
    const text = p.textContent?.trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      options.push({ label: text, element: null });
    }
  });
  return options;
}

function attachChip(block, question, optionData) {
  const chip = document.createElement("div");
  chip.className = "fqc-chip";
  chip.innerHTML = `
    <button type="button">Resolver com IA</button>
    <div class="message">Sem sugestões ainda</div>
  `;
  const button = chip.querySelector("button");
  const message = chip.querySelector(".message");

  button.addEventListener("click", () => {
    message.textContent = "Consultando IA...";
    message.classList.remove("success", "error");
    button.disabled = true;
    chrome.runtime.sendMessage(
      {
        type: "ask-ai",
        payload: { question, options: optionData.map((opt) => opt.label) }
      },
      (response) => {
        button.disabled = false;
        if (chrome.runtime.lastError) {
          showError(message, chrome.runtime.lastError.message);
          return;
        }
        if (response?.error) {
          showError(message, response.error);
          return;
        }
        const { result } = response || {};
        if (!result) {
          showError(message, "Sem retorno da IA.");
          return;
        }
        const markResult = markOption(optionData, result);
        if (markResult.success) {
          message.textContent = `Alternativa marcada: ${markResult.label}`;
          message.classList.add("success");
        } else {
          message.textContent = markResult.reason || "Não consegui marcar.";
          message.classList.add("error");
        }
      }
    );
  });

  block.appendChild(chip);
}

function showError(el, text) {
  el.textContent = text;
  el.classList.remove("success");
  el.classList.add("error");
}

function markOption(optionData, result) {
  if (!optionData.length) {
    return { success: false, reason: "Sem opções interativas." };
  }

  const normalized = (text) =>
    text
      ?.toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  let target = null;

  if (result.letter) {
    const letter = result.letter.trim().charAt(0).toUpperCase();
    const index = letter.charCodeAt(0) - 65;
    if (!Number.isNaN(index) && optionData[index]) {
      target = optionData[index];
    }
  }

  if (!target && result.answer) {
    const answerNorm = normalized(result.answer);
    target = optionData.find((opt) => {
      const labelNorm = normalized(opt.label);
      return labelNorm === answerNorm || labelNorm.includes(answerNorm) || answerNorm.includes(labelNorm);
    });
  }

  if (!target) {
    return { success: false, reason: "Resposta sugerida não encontrada." };
  }

  const clickable = target.element?.closest('[role="radio"], [role="checkbox"]') || target.element;
  if (!(clickable instanceof HTMLElement)) {
    return { success: false, reason: "Opção não clicável." };
  }

  clickable.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  clickable.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  clickable.click();

  return { success: true, label: target.label };
}
