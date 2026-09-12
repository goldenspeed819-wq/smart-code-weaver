# Smart Code Weaver

Aqui está a versão atualizada e aprimorada do prompt, focada em detecção automática do repositório via GitHub e no envio automático do resumo das alterações diretamente para o chat do Lovable ao finalizar o fluxo:

Copie e cole o texto abaixo no Lovable:

Crie um aplicativo web / extensão funcional que atue como um editor inteligente conectado ao GitHub e a múltiplas APIs de IA (como OpenAI, Anthropic, Google Gemini, Groq, etc.), capaz de editar o código-fonte de um site em tempo real com base nas imagens da interface que estou enviando.

O sistema deve seguir estritamente estes requisitos funcionais e de fluxo:

Detecção Automática do Repositório (GitHub):

Após o usuário inserir o seu Personal Access Token (PAT) do GitHub, a aplicação deve detectar automaticamente e listar os repositórios disponíveis na conta ou permitir colar a URL do projeto para identificar o repositório, branch padrão e árvore de arquivos sem digitação manual complexa.

Integração completa com a API do GitHub para clonar/ler a estrutura de pastas, carregar arquivos (.js, .jsx, .ts, .tsx, .html, .css), salvar e realizar commits automáticos das alterações aprovadas.

Multi-IA Assistant Hub:

Painel para cadastrar chaves de API de diferentes provedores (OpenAI, Anthropic, Gemini, Groq, etc.).

Seletor flutuante para escolher qual IA processará o pedido atual.

Capacidade de analisar as imagens da interface enviadas pelo usuário, cruzar com o código atual do arquivo selecionado e gerar o código corrigido ou estilizado.

Editor e Controle de Diff:

Editor de código com visualização de mudanças (Diff) antes de efetivar o commit.

Botão para aplicar o código gerado pela IA diretamente no arquivo do projeto.

Envio Automático do Resumo para o Chat:

Assim que o processo de edição, salvamento e commit for concluído com sucesso, o aplicativo deve enviar automaticamente um relatório/texto detalhado de todas as alterações feitas (arquivos modificados, o que mudou e o status do commit) diretamente de volta para o chat principal do Lovable.

Construa toda a interface visual inspirada exatamente nos layouts das fotos anexadas, garantindo uma experiência fluida, moderna e responsiva.
As imagens de como eu quero que seja: 

ela vai ser flutuante, ai igual na imagem, clica no botão de ligar, ai quando digitar e enviar no chat normal do lovable, a extensão que vai agir

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/669fd5d8-68b0-476b-b97d-00e8aad401df).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
