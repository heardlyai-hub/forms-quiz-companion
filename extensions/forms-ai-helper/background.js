const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ask-ai") return;

  handleQuestion(message.payload)
    .then((result) => sendResponse({ result }))
    .catch((error) => {
      console.error("ask-ai error", error);
      sendResponse({ error: error.message || String(error) });
    });

  return true; // keep channel open
});

async function handleQuestion(payload) {
  const { question, options } = payload;
  if (!question) {
    throw new Error("Pergunta não informada.");
  }

  const { apiKey, model } = await chrome.storage.sync.get({
    apiKey: "",
    model: DEFAULT_MODEL
  });

  if (!apiKey) {
    throw new Error("Configure sua chave da OpenAI na página de opções da extensão.");
  }

  const prompt = buildPrompt(question, options || []);

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente especialista em provas objetivas. Recebe uma pergunta e opções de resposta e retorna somente a melhor alternativa em JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha ao consultar a IA: ${response.status} ${detail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();

  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch (err) {
    return { answer: content, reason: "Retorno não pôde ser convertido em JSON." };
  }
}

function buildPrompt(question, options) {
  const optionsText = options
    .map((opt, index) => `${String.fromCharCode(65 + index)}. ${opt}`)
    .join("\n");

  return `Pergunta: ${question}\nOpções:\n${optionsText}\n\nResponda em JSON com o formato {"answer":"texto da opção", "letter":"A/B/C...", "confidence":"alta|media|baixa", "reason":"explicação"}.`;
}
