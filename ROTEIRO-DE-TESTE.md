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

## Anexo — scripts da stack de teste

| Script | Função |
| ------ | ------ |
| `smoke.ps1` | 27 verificações de infra, login, assets, leitura e erros esperados |
| `convert.ps1` | conversão "Baixar como" ponta a ponta |
| `build.ps1` | reconstrói o artefato `plugin\` a partir do fonte |
| `retest.ps1` | `build.ps1` + restart do Redmine + GET de uma URL |
| `setcfg.rb` | reaplica as configurações do plugin |
| `att8.rb` | inspeciona o anexo 8 (nome, tamanho, arquivo em disco) |
| `token.rb` | gera os JWT (URL e header) que o Document Server usa |
| `pptr/open-editor.js` | abre o editor no Chrome headless e inspeciona frames |
| `pptr/save-editor.js` | edita e fecha o editor, disparando o callback real |
| `e2e3.ps1` | conversão + "Salvar como" + salvamento de configurações (cria anexos) |
