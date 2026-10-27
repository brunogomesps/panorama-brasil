# Publicação: GitHub + link público gratuito

Guia passo a passo para pôr o Panorama Brasil no GitHub e gerar um link que qualquer pessoa abre no navegador, sem custo.

---

## 1. Por que dá para hospedar de graça

O painel é um **site estático**: só HTML, CSS, JavaScript e arquivos de dados já prontos (`web/`). Não tem servidor de aplicação, banco de dados nem login. Basta um serviço que entregue arquivos.

| O que | Onde roda | Precisa no servidor? |
|---|---|---|
| Painel (`web/`) | No navegador de quem acessa | Só hospedagem de arquivos |
| Coletores e `build.py` (Python) | No seu computador, quando for atualizar | Não |
| `server.js` e `iniciar.bat` | Só para uso local | Não |
| Teste de navegador (Playwright) | No seu computador | Não |

Peso do site: 7,3 MB em 31 arquivos. Com compressão, a primeira visita baixa cerca de 1 MB; a aba Municípios soma mais 1,1 MB, carregados só quando ela é aberta.

---

## 2. Onde hospedar (todas com plano gratuito)

| Serviço | Grátis com | Pontos a favor | Atenção |
|---|---|---|---|
| **GitHub Pages (recomendado)** | Repositório **público** | Tudo num lugar só: código + site. Publica sozinho a cada `git push` (o workflow já está pronto em `.github/workflows/pages.yml`). Endereço `https://<usuario>.github.io/panorama-brasil/` | Site até 1 GB e cota de uso de ~100 GB/mês (limite brando). Repositório privado com Pages exige plano pago |
| Cloudflare Pages | Repositório público **ou privado** | Sem limite de banda no plano gratuito; CDN rápida no Brasil | Mais uma conta para criar; conecta ao GitHub |
| Netlify | Repositório público ou privado, ou arrastar a pasta `web/` no site | Publicação por arrastar e soltar, sem Git | Plano gratuito com cota mensal de uso |
| Vercel (Hobby) | Público ou privado | Simples | Plano gratuito só para uso não comercial |

Estimativa de capacidade no GitHub Pages: 100 GB/mês ÷ ~1,5 MB por visita ≈ **60 mil visitas por mês**, folgado para um projeto pessoal. Se um dia passar disso, migre para o Cloudflare Pages sem mudar nada no código.

**Recomendação:** GitHub Pages com repositório público. Se quiser manter o código privado e só o site público, use o Cloudflare Pages (passo 6).

---

## 3. O que já foi preparado no projeto

- [x] `.gitignore`: tira do Git o cache de coleta (`data/cache/`), as capturas e a saída dos testes, `__pycache__` e arquivos de sistema.
- [x] `.gitattributes`: fim de linha padronizado (o `.bat` continua com CRLF); dados gerados não poluem os diffs nem as estatísticas de linguagem.
- [x] `LICENSE`: MIT para o código, com a ressalva de que dados, bibliotecas e conteúdo pesquisado seguem os termos de cada fonte.
- [x] `.github/workflows/pages.yml`: publica a pasta `web/` no GitHub Pages a cada push na `main`.
- [x] `README.md`: link online (a preencher), aviso de projeto independente, licenças e como apontar erros.
- [x] `web/index.html`: metadados de compartilhamento (título e descrição aparecem ao colar o link no WhatsApp, LinkedIn etc.).
- [x] Dados pessoais e corporativos removidos dos documentos (e-mail, caminhos locais e pastas da empresa).
- [x] Nenhum arquivo acima de 50 MB (o maior é `data/processed/ibge_series.csv`, com 21 MB). O GitHub recusa arquivos acima de 100 MB.
- [x] Bibliotecas com licenças que permitem redistribuição: D3 7.9.0 (ISC), ApexCharts 3.54.1 (MIT) e topojson-client 3.1.0 (ISC). **Não atualize o ApexCharts para a versão 4 ou maior sem checar a licença**, que mudou.

Tamanho do repositório: cerca de 48 MB (dados processados 36 MB, malhas 3,8 MB, painel 7,3 MB).

---

## 4. Decisões antes de publicar

1. **E-mail dos commits.** Não use o e-mail da empresa. No GitHub, ative *Settings → Emails → Keep my email addresses private* e use o endereço `NUMERO+usuario@users.noreply.github.com` que aparece ali.
2. **Nome do repositório.** Sugestão: `panorama-brasil`. Se usar outro nome, o link muda junto.
3. **Público ou privado.** Público = GitHub Pages grátis. Privado = use o Cloudflare Pages para o site.
4. **Licença.** Está como MIT em nome de "Bruno Gomes". Troque o nome no `LICENSE` se preferir outro.
5. **Pasta no OneDrive da empresa.** O Git funciona dentro do OneDrive, mas a sincronização pode travar arquivos da pasta `.git` durante um commit. Como o GitHub passa a ser o backup, o mais seguro é trabalhar numa pasta fora do OneDrive, por exemplo `C:\Projetos\panorama-brasil`. Por ser um projeto pessoal, também evita deixá-lo no armazenamento corporativo.

---

## 5. Passo a passo: GitHub + GitHub Pages

### 5.1 Uma vez só, no computador
Abra o **Git Bash** ou o PowerShell (o Git 2.55 já está instalado):

```
git config --global user.name  "Seu Nome"
git config --global user.email "NUMERO+usuario@users.noreply.github.com"
```

### 5.2 Criar o repositório no site
1. Entre em https://github.com (crie a conta se ainda não tiver).
2. Clique em **New repository**.
3. Nome: `panorama-brasil`; visibilidade: **Public**.
4. **Não** marque README, .gitignore nem licença: o projeto já tem os três.
5. Clique em **Create repository** e copie a URL (`https://github.com/<usuario>/panorama-brasil.git`).

### 5.3 Primeiro envio
Na pasta `panorama-brasil` (de preferência já fora do OneDrive):

```
git init -b main
git add .
git status                      # confira: não pode aparecer data/cache nem tests/capturas
git commit -m "Primeira versão do Panorama Brasil"
git remote add origin https://github.com/<usuario>/panorama-brasil.git
git push -u origin main
```

No primeiro `push`, o Git Credential Manager (vem com o Git para Windows) abre o navegador para você entrar no GitHub. Não é preciso criar token à mão.

### 5.4 Ligar o GitHub Pages
1. No repositório: **Settings → Pages**.
2. Em *Build and deployment → Source*, escolha **GitHub Actions**.
3. Vá na aba **Actions**: o workflow "Publicar no GitHub Pages" roda sozinho (se não rodar, clique em *Run workflow*). Leva de 1 a 2 minutos.
4. Quando ficar verde, o link aparece no próprio workflow e em Settings → Pages: `https://<usuario>.github.io/panorama-brasil/`.

### 5.5 Acabamento
- No `README.md`, troque `SEU-USUARIO` pelo seu usuário e faça commit + push.
- Na página do repositório, clique na engrenagem de **About**: cole o link do site em *Website* e adicione tópicos (`brasil`, `dados-abertos`, `eleicoes`, `ibge`, `tse`, `dashboard`).
- Abra o link no celular e num navegador anônimo para conferir.

---

## 6. Alternativa: Cloudflare Pages (código privado, site público)

1. Crie o repositório como **Private** e faça os passos 5.1 a 5.3.
2. Crie uma conta em https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**.
3. Escolha o repositório. Em *Build settings*: framework **None**, comando de build **vazio** e *Build output directory* **`web`**.
4. **Save and Deploy**. O link fica `https://panorama-brasil.pages.dev` (ou parecido) e é atualizado a cada push.
5. Nesse caso o workflow `.github/workflows/pages.yml` não é usado e pode ser apagado.

Sem Git nenhum: no Netlify (https://app.netlify.com/drop), arraste a pasta `web/` para a página. O link sai na hora, mas cada atualização exige arrastar de novo.

---

## 7. Como atualizar depois de publicado

```
python scripts/fetch_ibge.py      # e os outros coletores, se quiser dados novos
python scripts/build.py
python tests/e2e_navegador.py     # precisa terminar com FALHAS: 0
git add .
git commit -m "Atualiza dados de <mês/ano>"
git push
```

O site se republica sozinho em 1 a 2 minutos. Se a página não mudar, recarregue com Ctrl+F5 (cache do navegador).

---

## 8. Opcional

- **Domínio próprio** (ex.: `panoramabrasil.com.br`): registro no registro.br, pago por ano. Depois, em Settings → Pages → *Custom domain*, informe o domínio e crie no registro.br o apontamento indicado pelo GitHub. O HTTPS é gratuito e automático.
- **Imagem de prévia do link** (`og:image`): uma imagem 1200 × 630 px na pasta `web/` e a tag `<meta property="og:image" content="https://<usuario>.github.io/panorama-brasil/previa.png">` no `index.html`. Só dá para pôr depois de saber o endereço final.
- **Fontes sem Google:** o painel carrega Raleway e Noto Sans do Google Fonts, o que envia o IP de quem acessa ao Google. Para evitar, baixe as fontes para `web/fonts/` e troque o `<link>` por `@font-face`.

---

## 9. Cuidados por ser público

- **Conteúdo político:** o aviso de independência está no README. O painel não traz opinião e cada item pesquisado tem fonte e grau de confiança; correções podem chegar por *issues*.
- **Privacidade:** o painel não coleta nada de quem acessa: sem cookies, sem analytics, sem formulário. O `localStorage` guarda só o tema claro ou escuro.
- **Material de terceiros:** a análise da Cubo Três e as capturas dela ficam fora do repositório e não devem ser publicadas.
- **Segredos:** o projeto não usa senha, token nem chave de API. Se algum dia usar, nunca faça commit deles; use *Settings → Secrets* do GitHub.
