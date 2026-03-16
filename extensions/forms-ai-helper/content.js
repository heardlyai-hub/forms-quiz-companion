const STYLE_ID = "forms-quiz-companion-style";

const style = `
.fqc-trigger {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  padding: 0;
  margin: 0;
  cursor: pointer;
  text-decoration: none;
  position: relative;
}
.fqc-trigger::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: currentColor;
  opacity: 0.12;
}
.fqc-trigger:hover::after {
  opacity: 0.35;
}
.fqc-trigger:focus-visible {
  outline: 2px solid rgba(26, 115, 232, 0.35);
  border-radius: 2px;
}
.fqc-trigger--busy {
  opacity: 0.6;
}
.fqc-trigger--ok {
  color: #1a73e8;
}
.fqc-trigger--error {
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
    const questionInfo = extractQuestion(block);
    const optionData = collectOptionData(block);
    if (!questionInfo?.text || !optionData.length) return;
    const trigger = toTrigger(questionInfo.node);
    if (!trigger) return;
    block.dataset.fqcEnhanced = "true";
    attachTrigger(trigger, questionInfo.text, optionData);
  });
}

function extractQuestion(block) {
  const heading = block.querySelector('[role="heading"], .M7eMe');
  if (heading?.textContent?.trim()) {
    return { text: heading.textContent.trim(), node: heading };
  }
  const label = block.querySelector('.Qr7Oae');
  if (label?.textContent?.trim()) {
    return { text: label.textContent.trim(), node: label };
  }
  return null;
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

function toTrigger(container) {
  if (!(container instanceof HTMLElement)) return null;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  const textNode = walker.nextNode();
  if (!textNode) return null;

  const match = textNode.textContent.match(/^(\s*)(\S+)([\s\S]*)$/);
  if (!match) return null;
  const [, leading, firstWord, rest] = match;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "fqc-trigger";
  button.textContent = firstWord;
  button.title = "Resolver esta questão com IA";

  const fragment = document.createDocumentFragment();
  if (leading) fragment.appendChild(document.createTextNode(leading));
  fragment.appendChild(button);
  if (rest) fragment.appendChild(document.createTextNode(rest));

  textNode.parentNode.replaceChild(fragment, textNode);
  return button;
}

function attachTrigger(trigger, questionText, optionData) {
  trigger.addEventListener("click", () => {
    if (trigger.dataset.fqcBusy === "1") return;
    trigger.dataset.fqcBusy = "1";
    trigger.classList.remove("fqc-trigger--ok", "fqc-trigger--error");
    trigger.classList.add("fqc-trigger--busy");

    chrome.runtime.sendMessage(
      {
        type: "ask-ai",
        payload: { question: questionText, options: optionData.map((opt) => opt.label) }
      },
      (response) => {
        trigger.dataset.fqcBusy = "0";
        trigger.classList.remove("fqc-trigger--busy");
        if (chrome.runtime.lastError) {
          flashState(trigger, "fqc-trigger--error");
          console.error("Forms Quiz Companion", chrome.runtime.lastError.message);
          return;
        }
        if (response?.error) {
          flashState(trigger, "fqc-trigger--error");
          console.error("Forms Quiz Companion", response.error);
          return;
        }
        const { result } = response || {};
        if (!result) {
          flashState(trigger, "fqc-trigger--error");
          return;
        }
        const markResult = markOption(optionData, result);
        flashState(trigger, markResult.success ? "fqc-trigger--ok" : "fqc-trigger--error");
        if (!markResult.success) {
          console.warn("Forms Quiz Companion", markResult.reason);
        }
      }
    );
  });
}

function flashState(trigger, className) {
  trigger.classList.add(className);
  setTimeout(() => trigger.classList.remove(className), 1800);
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
