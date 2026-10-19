# Roteiro de teste — ONLYOFFICE para Redmine 7

Objetivo: validar o port do plugin `onlyoffice-redmine` **3.2.0** no Redmine 7
(imagem oficial `redmine:7.0`), cobrindo leitura, edição/salvamento, conversão,
configurações e segurança.

---

## 1. Ambiente

| Serviço           | Imagem                              | Endereço                 |
| ----------------- | ----------------------------------- | ------------------------ |
| Redmine           | `redmine:7.0-alpine`                | http://localhost:3000    |
| Document Server   | `onlyoffice/documentserver-de:7.5.1.1` | http://localhost:8090 |
| PostgreSQL        | `postgres:16`                       | interno                  |

Versões verificadas: Redmine `7.0.2.stable`, Rails `8.1.4`, Ruby `4.0.7`,
Document Server `7.5.1-23`.

Credenciais: **admin / admin123**. Projeto de teste: **oo-test**.

Caminhos:

| O quê | Onde |
| ----- | ---- |
| Fonte do plugin | `C:\ProjetosUSA\PluginRedmine\onlyoffice-redmine` |
| Stack de teste (compose + scripts) | `C:\Users\Fernando\AppData\Local\Temp\opencode\rm7` |
| Artefato montado no container | `...\rm7\plugin` — **não** é a pasta do fonte |

> **Importante:** o container monta o *artefato* (`rm7\plugin`), não o fonte.
> Depois de qualquer alteração no código do plugin é preciso reconstruir:
> `build.ps1` + restart do Redmine (produção carrega o código no boot).

### Dados de teste (fixtures)

| Anexo | Arquivo | Observação |
| ----- | ------- | ---------- |
| 8 | `real.docx` | documento real, editável — usado na maioria dos testes |
| 1 | `sample.docx` | fixture pequena |
| 2 | `sample.png` | imagem |
| 9 | `saved-conversion.pdf` | criado por um teste de "Salvar como" |
| 13 / 14 | `fluxo.mmd` / `fluxo.mermaid` | diagramas Mermaid avulsos |
| 15 | `blocks.md` | documento com todos os tipos de bloco (recriado por `blocksfix.rb`) |
| 18 | `mermaid-inline.md` | cerca ```` ```mermaid ```` dentro de um `.md` (recriado por `mermaidfix.rb`) |
| wiki `Mermaid` | página do projeto `oo-test` | cerca ```` ```mermaid ```` fora das views do plugin (recriada por `wikimermaid.rb`) |

As fixtures ficam no volume do PostgreSQL: `docker compose down` (sem `-v`)
preserva tudo.

### Subir / derrubar

```powershell
cd C:\Users\Fernando\AppData\Local\Temp\opencode\rm7

docker compose up -d          # subir
docker compose ps             # estado
docker compose down           # parar (mantém dados)
docker compose logs -f redmine    # log da aplicação
docker compose down -v        # ATENÇÃO: apaga o banco e as fixtures
```

### Configuração do plugin (topologia em uso)

O stack usa endereço **dividido**, que é o caso real de qualquer deploy em
Docker (o navegador fala com `localhost:8090`; o Redmine, de dentro do
container, precisa falar com `documentserver`):

| Campo da tela `/settings/plugin/onlyoffice_redmine` | Valor |
| --------------------------------------------------- | ----- |
| `onlyoffice[document_server_url]` (endereço p/ o navegador) | `http://localhost:8090/` |
| `onlyoffice[document_server_internal_url]` (endereço p/ o plugin) | `http://documentserver/` |
| `onlyoffice[plugin_internal_url]` (endereço p/ o Document Server) | `http://redmine:3000/` |
| `onlyoffice[jwt_secret]` | `secret` |
| `onlyoffice[jwt_http_header]` | `Authorization` |

Reaplicar via linha de comando:

```powershell
docker compose cp setcfg.rb redmine:/tmp/setcfg.rb
docker compose exec -T -u redmine -e RAILS_ENV=production -e SECRET_KEY_BASE=supersecretkeybase `
  redmine bundle exec rails runner /tmp/setcfg.rb
```

> Sempre rode `rails runner` como usuário `redmine` (`-u redmine`). Como root
> os arquivos criados em `/usr/src/redmine/files` ficam com dono errado.

---

## 2. Teste automatizado rápido (leitura + segurança)

```powershell
cd C:\Users\Fernando\AppData\Local\Temp\opencode\rm7
powershell -ExecutionPolicy Bypass -File smoke.ps1
```

Resultado esperado: **`27 PASS / 0 FAIL`** e código de saída `0`.

O que ele cobre:

| Seção | Verificações |
| ----- | ------------ |
| 1. Infraestrutura | 3 containers `Up`, `/healthcheck` do DS, Redmine `/` |
| 2. Login | login do admin |
| 3. Assets do plugin | `main-*.js` e `main-*.css` referenciados e servidos (200) |
| 4. Páginas do plugin | settings, issue, anexos 1/8, *files*, *documents*, *news*, *forums*, `view`/`edit`/`convert` |
| 5. Endpoint interno | `/onlyoffice/attachments/8/download` **com** JWT do Document Server → 200 (arquivo entregue) |
| 6. Erros esperados | `ping` sem JWT → 401; `download` sem JWT → 401; `edit` anônimo → 403; anexo inexistente → 404; `callback` por GET → 404 (rota é POST) |

> O teste 5 monta os dois tokens que o Document Server envia nas chamadas
> internas: o token de URL (fallback JWT) e o do header `Authorization`. Com
> endereço de Document Server configurado, os dois são exigidos — é assim que o
> fluxo real funciona.

---

## 3. Teste de conversão ("Baixar como")

```powershell
powershell -ExecutionPolicy Bypass -File convert.ps1
```

Esperado: a URL devolvida começa com `http://localhost:8090/` (endereço
**público**) e o arquivo é baixado (PDF de ~23 KB).

Esse teste cobre uma correção do port: antes, a URL era mapeada no sentido
errado (público → interno) e o navegador recebia
`http://documentserver/cache/files/...`, que ele não consegue resolver. Ver
"Problemas conhecidos" caso reapareça.

Variantes: `-AttachmentId 8 -To txt` ou `-To pdf`.

---

## 4. Teste manual no navegador

Faça este roteiro com o navegador comum (é o cenário do usuário final).

1. Abra <http://localhost:3000> e entre com **admin / admin123**.
2. Vá em **oo-test → Issues → issue 1** (`/issues/1`).
3. No anexo **real.docx**, confirme que aparece a ação do ONLYOFFICE
   (**Visualizar** / **Editar** / **Converter**). Ao lado do link do anexo, o
   ícone do plugin deve aparecer (SVG próprio do plugin — o Redmine 7 não
   fornece o sprite antigo, e o fallback funciona).
4. **Visualizar**: clique em *Visualizar* — o editor abre com o documento em
   modo leitura.
5. **Editar**: clique em *Editar* — o editor abre em modo edição.
6. Anote o **tamanho e a data** do anexo (na própria página do anexo).
7. Digite algo no documento, aguarde o ícone de "salvo" do editor e **feche a
   aba do editor** (ou o editor).
8. Aguarde **30 a 60 segundos** (o Document Server fecha a sessão e chama o
   callback do Redmine).
9. Recarregue a issue: o anexo `real.docx` deve ter **tamanho/data novos**, e no
   log deve constar:

   ```powershell
   docker compose logs --since 5m redmine | Select-String "ready to be saved"
   ```

   Esperado: `The document is ready to be saved` (com `Completed 200`).
10. **Converter**: clique em *Converter*, escolha PDF, e depois:
    - *Baixar como* → o download começa (vem de `http://localhost:8090/...`);
    - *Salvar como* → é criado um **novo anexo** na issue.
11. **Configurações**: abra `/settings/plugin/onlyoffice_redmine`, confirme que
    os campos estão preenchidos conforme a tabela da seção 1, altere algo
    (ex.: marque/desmarque *chat*) e salve → "Successful update".
12. Repita os passos 3–5 em outro contexto (aba **Files** do projeto, uma
    **wiki**, um **fórum**) para confirmar que os botões aparecem em todas as
    telas: `/projects/oo-test/files`, `/documents/1`, `/boards/1/topics/1`.

---

## 5. Salvamento end-to-end com editor real (automático)

Este é o teste crítico do port: abre o editor de verdade (Chrome sem interface),
digita, fecha, e confere que o callback gravou o arquivo.

```powershell
cd C:\Users\Fernando\AppData\Local\Temp\opencode\rm7

# 1) estado do anexo antes
docker compose cp att8.rb redmine:/tmp/att8.rb
docker compose exec -T -u redmine -e RAILS_ENV=production -e SECRET_KEY_BASE=supersecretkeybase `
  redmine bundle exec rails runner /tmp/att8.rb

# 2) abre o editor, digita e fecha
cd pptr
node save-editor.js

# 3) aguarda o callback (~45 s) e confere
cd ..
Start-Sleep -Seconds 45
docker compose logs --since 3m redmine | Select-String "ready to be saved"
docker compose exec -T -u redmine -e RAILS_ENV=production -e SECRET_KEY_BASE=supersecretkeybase `
  redmine bundle exec rails runner /tmp/att8.rb
```

Critérios de aprovação:

- log com `The document is ready to be saved`;
- `filesize(db)` e `disk_filename` diferentes dos do passo 1 (o Redmine cria um
  novo arquivo em disco a cada salvamento);
- nenhum `Unknown status` / erro no log.

Para apenas abrir o editor e inspecionar frames/console:

```powershell
cd C:\Users\Fernando\AppData\Local\Temp\opencode\rm7\pptr
node open-editor.js
```

---

## 6. Testes negativos / segurança

| Cenário | Como | Esperado |
| ------- | ---- | -------- |
| `/onlyoffice/ping` sem JWT | navegador anônimo | `401` (não `500`) |
| `/onlyoffice/attachments/8/download` sem JWT | navegador anônimo | `401` |
| `/onlyoffice/attachments/8/edit` anônimo | navegador anônimo | `403` (login exigido) |
| Anexo inexistente | `/onlyoffice/attachments/999999/view` | `404` |
| Callback por GET | `/onlyoffice/attachments/8/callback?user_id=1` | `404` (rota é POST) |
| Callback com corpo inválido | POST sem token | `401`, sem salvar nada |
| Usuário sem permissão de leitura | usuário sem papel no projeto | `403` |

Os quatro primeiros são verificados automaticamente pelo `smoke.ps1`.

---

## 7. Checklist de aceite

- [ ] `smoke.ps1` → 27 PASS / 0 FAIL
- [ ] `convert.ps1` → URL pública + download OK
- [ ] `mmdview.ps1` → 27 PASS / 0 FAIL
- [ ] `blocksview.ps1` → 20 PASS / 0 FAIL
- [ ] Diagramas `.mmd` / `.mermaid` renderizam na página do anexo
- [ ] Editor de blocos salva `.md` e faz o round-trip de `.docx`
- [ ] Editor abre em *Visualizar* e *Editar* (`real.docx`)
- [ ] Salvamento grava o arquivo (log + tamanho/data novos)
- [ ] Botões do plugin aparecem em issue, files, documents, news, fórum, wiki
- [ ] Assets `main-*.css` / `main-*.js` e os ícones SVG carregam (200)
- [ ] Tela de configurações salva sem erro
- [ ] Nenhum `500` em nenhuma das telas percorridas
- [ ] `anonymous` não acessa edição nem endpoints internos

---

## 8. Problemas conhecidos / solução de problemas

| Sintoma | Causa provável | Ação |
| ------- | -------------- | ---- |
| Alteração no código não tem efeito | o container monta o artefato | `build.ps1` + `docker compose restart redmine` |
| Editor abre mas não carrega o documento | `document_server_internal_url` errado | conferir se o plugin alcança `http://documentserver/` |
| "Baixar como" devolve `http://documentserver/...` | URL mapeada no sentido errado | deve ser `resolve_url` (interno → público) em `download_as` |
| Download do anexo retorna `401` no log | os dois JWT são exigidos (segredo + fallback) | usar `smoke.ps1`, que assina ambos |
| `Errno::EACCES` ao criar anexo | script rodado como root | rodar `rails runner` com `-u redmine` |
| Callback não chega em 10 s | o Document Server só fecha a sessão depois | aguardar 30–60 s após fechar o editor |
| Erro de sintaxe em arquivo Ruby | arquivo gravado em UTF-16 com BOM | gravar com UTF-8 |

Comandos úteis:

```powershell
docker compose logs --tail 100 redmine
docker compose exec redmine sh -c "ls -l /usr/src/redmine/files/2026/10 | tail"
docker compose restart redmine
```

---

## 9. Diagramas Mermaid e editor de blocos (fases 2, 3 e 4)

### 9.1 Diagramas Mermaid (fase 2)

Os anexos `.mmd` / `.mermaid` são renderizados na própria página do anexo.

```powershell
cd C:\Users\Fernando\AppData\Local\Temp\opencode\rm7
powershell -ExecutionPolicy Bypass -File mmdview.ps1     # 29 PASS / 0 FAIL

cd pptr
node render-mermaid.js                                   # 9 PASS por diagrama
```

Critérios: SVG gerado dentro do bloco do diagrama, fonte do diagrama disponível
e nenhum erro de página. A biblioteca não é mais incluída na página: o
`mermaid-lazy.js` (incluído em todas as páginas pelo hook `view_layouts_base_html_head`)
baixa o `mermaid.min.js` só quando a página tem um elemento `.mermaid`.

### 9.2 Editor de blocos (fase 3)

O paradigma de edição fica nas configurações globais do plugin.

```powershell
# alterna o paradigma (blocks | onlyoffice)
docker compose exec -T -u redmine -e RAILS_ENV=production -e SECRET_KEY_BASE=supersecretkeybase `
  redmine bundle exec rails runner /tmp/paradigm.rb blocks
```

Testes automatizados:

```powershell
cd C:\Users\Fernando\AppData\Local\Temp\opencode\rm7
powershell -ExecutionPolicy Bypass -File blocksview.ps1        # 20 PASS / 0 FAIL

cd pptr
node settings-paradigm.js     # salva o paradigma pela tela de configurações
node blocks-editor.js 15      # anexo .md: renderização, atalhos e salvamento
node blocks-docx.js 8         # .docx: abre como Markdown e salva de volta em .docx
node blocks-slash.js 15       # menu "/": filtro, setas, Escape, clique e persistência
```

| Cenário | Esperado |
| ------- | -------- |
| Paradigma `onlyoffice` | links de edição apontam para `/onlyoffice/attachments/:id/edit` |
| Paradigma `blocks` | links de edição apontam para `/onlyoffice/attachments/:id/blocks` |
| Anexo `.md` ou `.txt` | abre no editor de blocos sem conversão |
| Anexo `.docx` / `.odt` / `.rtf` / `.txt` | convertido para Markdown ao abrir (com aviso na tela) e convertido de volta ao salvar |
| Blocos | títulos, parágrafos, listas, listas de tarefas, citações, código, diagramas e divisores |
| Atalhos | `#`, `##`, `-`, `1.`, `>`, `---` e crase tripla |
| Menu `/` | digitar `/` abre a lista com os 11 tipos; filtrar por nome ou alias (`/h1`, `/todo`, `/mermaid`), navegar com as setas, aplicar com `Enter`/`Tab` ou clique; `Escape` fecha; `/` dentro de um bloco de código é texto normal |
| Salvamento | `POST /onlyoffice/attachments/:id/blocks/save` grava o arquivo e o Markdown recarregado contém a alteração |
| Fidelidade do `.docx` | depois de salvar, o arquivo reabre como `.docx` válido e a alteração aparece |
| Limite de tamanho | conteúdo acima de `Setting.attachment_max_size` é recusado com `413` |

Observações:

- o editor de blocos grava sempre a representação Markdown; ao salvar um `.docx`,
  o Document Server converte o Markdown de volta para `.docx` (parte da
  formatação original pode ser perdida — a tela avisa antes de abrir);
- a chave do documento no Document Server é o token do anexo (`id.digest`),
  então um arquivo alterado fora do editor não é servido a partir do cache.

### 9.3 Mermaid embutido nos documentos (fase 4)

Uma cerca ```` ```mermaid ```` (ou ```` ```mmd ````) no conteúdo Markdown é
renderizada como diagrama na página que exibe o conteúdo — anexo `.md`, wiki,
descrição/notas de issue, notícias e documentos. A fonte fica recolhida em
"Diagram source", embaixo do diagrama.

```powershell
# recria as fixtures
docker compose cp mermaid-inline.md redmine:/tmp/mermaid-inline.md
docker compose cp mermaidfix.rb redmine:/tmp/mermaidfix.rb
docker compose cp wikimermaid.rb redmine:/tmp/wikimermaid.rb
docker compose exec -T -u redmine -e RAILS_ENV=production -e SECRET_KEY_BASE=supersecretkeybase `
  redmine bundle exec rails runner /tmp/mermaidfix.rb      # anexo 18
docker compose exec -T -u redmine -e RAILS_ENV=production -e SECRET_KEY_BASE=supersecretkeybase `
  redmine bundle exec rails runner /tmp/wikimermaid.rb     # wiki "Mermaid"

cd pptr
node mermaid-inline.js 18     # 36 PASS / 0 FAIL
```

| Cenário | Esperado |
| ------- | -------- |
| Anexo `.md` com a cerca | a cerca vira diagrama e a página não tem mais `pre code[data-language=mermaid]` |
| Wiki / issue / notícias | mesma renderização (o hook não depende das views do plugin) |
| Página sem diagrama | `window.mermaid` indefinido — o `mermaid.min.js` (3,4 MB) não é baixado |
| Fonte | seção "Diagram source" com o texto da cerca |
| Editor de blocos | bloco de código `mermaid` desenha o diagrama embaixo da fonte, atualizado enquanto digita |
| Botão do diagrama | `▾`/`▸` recolhe e expande o diagrama do bloco |
| Menu `/` | `/mermaid` insere um bloco com o modelo `flowchart LR` e o diagrama já desenhado |
| Barra de ferramentas | botão `◇` converte o bloco atual em diagrama |
| Salvar | as cercas ```` ```mermaid ```` permanecem no Markdown e os três diagramas reabrem desenhados |
| `Enter` no bloco de código | insere quebra de linha real (`\n`), preservada no Markdown |

Observações:

- o diagrama é desenhado no navegador (a biblioteca é vendorizada e roda com
  `securityLevel: "strict"`); nada é enviado ao Document Server;
- dentro do `.docx` aberto no editor ONLYOFFICE a cerca aparece como texto: o
  diagrama vivo só existe no editor de blocos e nas páginas do Redmine.

---

## Anexo — scripts da stack de teste

| Script | Função |
| ------ | ------ |
| `smoke.ps1` | 29 verificações de infra, login, assets, leitura e erros esperados |
| `convert.ps1` | conversão "Baixar como" ponta a ponta |
| `build.ps1` | reconstrói o artefato `plugin\` a partir do fonte |
| `retest.ps1` | `build.ps1` + restart do Redmine + GET de uma URL |
| `setcfg.rb` | reaplica as configurações do plugin |
| `att8.rb` | inspeciona o anexo 8 (nome, tamanho, arquivo em disco) |
| `token.rb` | gera os JWT (URL e header) que o Document Server usa |
| `pptr/open-editor.js` | abre o editor no Chrome headless e inspeciona frames |
| `pptr/save-editor.js` | edita e fecha o editor, disparando o callback real |
| `e2e3.ps1` | conversão + "Salvar como" + salvamento de configurações (cria anexos) |
| `mmdview.ps1` | renderização dos anexos `.mmd` / `.mermaid` na página do anexo |
| `blocksview.ps1` | paradigma nos links, páginas do editor de blocos e conteúdo |
| `paradigm.rb` | alterna o paradigma de edição (`blocks` / `onlyoffice`) |
| `mdenable.rb` | liga/desliga o formato `md` em `formats_editable` |
| `blocksfix.rb` | recria o anexo 15 (`blocks.md`) com todos os tipos de bloco |
| `mermaidfix.rb` | recria o anexo 18 (`mermaid-inline.md`) com a cerca ```` ```mermaid ```` |
| `wikimermaid.rb` | recria a página de wiki `Mermaid` do projeto `oo-test` |
| `pptr/render-mermaid.js` | abre a página do diagrama e confere o SVG gerado |
| `pptr/blocks-editor.js` | edita e salva um `.md` no editor de blocos |
| `pptr/blocks-slash.js` | exercita o menu `/` (filtro, setas, Escape, clique, persistência) |
| `pptr/blocks-docx.js` | abre um `.docx`, edita e salva de volta em `.docx` |
| `pptr/settings-paradigm.js` | troca o paradigma pela tela de configurações |
| `pptr/mermaid-inline.js` | diagrama embutido: anexo, wiki, bloqueio do download sem diagrama, editor de blocos, menu `/`, barra e salvamento |
