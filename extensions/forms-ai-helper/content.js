const STYLE_ID = "forms-quiz-companion-style";

const style = `
.fqc-chip {
  position: relative;
  margin-top: 0.75rem;
  border-radius: 12px;
  padding: 0.65rem 0.9rem;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #e2e8f0;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.4);
}
.fqc-chip button {
  border: none;
  background: linear-gradient(120deg, #38bdf8, #0ea5e9);
  color: white;
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  font-size: 0.8rem;
  cursor: pointer;
}
.fqc-chip small {
  color: #94a3b8;
}
.fqc-chip .answer {
  font-weight: 600;
  color: #f8fafc;
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
    const options = extractOptions(block);
    if (!question || !options.length) return;
    block.dataset.fqcEnhanced = "true";
    attachChip(block, question, options);
  });
}

function extractQuestion(block) {
  const heading = block.querySelector('[role="heading"], .M7eMe');
  if (heading?.textContent?.trim()) return heading.textContent.trim();
  const label = block.querySelector('.Qr7Oae');
  return label?.textContent?.trim() || "";
}

function extractOptions(block) {
  const radios = block.querySelectorAll('[role="radio"], [role="checkbox"]');
  const options = new Set();
  radios.forEach((el) => {
    const text = el.getAttribute("aria-label") || el.textContent;
    if (text?.trim()) options.add(text.trim());
  });
  if (options.size) return Array.from(options);

  const paragraphs = block.querySelectorAll('div[dir="auto"]');
  paragraphs.forEach((p) => {
    if (p.textContent?.trim()) options.add(p.textContent.trim());
  });
  return Array.from(options);
}

function attachChip(block, question, options) {
  const chip = document.createElement("div");
  chip.className = "fqc-chip";
  chip.innerHTML = `
    <button type="button">Sugerir resposta</button>
    <div class="message">Clique para sugerir</div>
  `;
  const button = chip.querySelector("button");
  const message = chip.querySelector(".message");

  button.addEventListener("click", () => {
    message.textContent = "Consultando IA...";
    button.disabled = true;
    chrome.runtime.sendMessage(
      {
        type: "ask-ai",
        payload: { question, options }
      },
      (response) => {
        button.disabled = false;
        if (chrome.runtime.lastError) {
          message.textContent = chrome.runtime.lastError.message;
          return;
        }
        if (response?.error) {
          message.textContent = response.error;
          return;
        }
        const { result } = response || {};
        if (!result) {
          message.textContent = "Sem retorno da IA.";
          return;
        }
        const answer = result.answer || result.letter || "Resposta sugerida";
        const confidence = result.confidence ? ` (${result.confidence})` : "";
        message.innerHTML = `<span class="answer">${answer}</span>${confidence}`;
        if (result.reason) {
          const reason = document.createElement("small");
          reason.textContent = result.reason;
          chip.appendChild(reason);
        }
      }
    );
  });

  block.appendChild(chip);
}
