# Forms Quiz Companion

Uma extensão de Chrome que detecta questionários/provas feitos no Google Forms e sugere respostas usando a API da OpenAI.

## Recursos
- Detecta automaticamente perguntas de múltipla escolha em `docs.google.com/forms`.
- Adiciona um chip discreto, com a mesma paleta do Forms, contendo o botão **“Resolver com IA”**.
- Ao receber a resposta da OpenAI, marca automaticamente a alternativa correspondente no formulário (sem destacar texto).
- Mantém um aviso mínimo no chip para informar se a marcação foi feita ou se houve algum erro.
- Configuração simples da API key e modelo preferido via página de opções da extensão.

## Como usar
1. Acesse `chrome://extensions`, ative o **Modo do desenvolvedor** e clique em **Carregar sem compactação**.
2. Selecione a pasta `extensions/forms-ai-helper`.
3. Abra a página de opções da extensão e informe sua **OpenAI API Key** (modelo padrão `gpt-4o-mini`).
4. Abra qualquer questionário do Google Forms. Use o botão **“Resolver com IA”** para cada pergunta; a alternativa será marcada automaticamente.

## Estrutura
```
manifest.json        Configuração MV3
background.js        Service worker que consulta a API da OpenAI
content.js           Injeta botões nas perguntas do Forms
options.html/js      Página para salvar a API key e modelo
```

> **Importante:** guarde sua API key com segurança. A extensão usa `chrome.storage.sync`, que é criptografado pela conta Google do usuário.
