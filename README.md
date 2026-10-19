# Plugin ONLYOFFICE para Redmine 7

Port do plugin [ONLYOFFICE para Redmine](https://github.com/ONLYOFFICE/onlyoffice-redmine)
para o Redmine 7 (`redmine:7.0`), com Markdown, diagramas Mermaid e um editor de
blocos no estilo Notion.

## Conteúdo

| Caminho | O que é |
| ------- | ------- |
| `plugin/` | código do plugin — mesma árvore do repositório do plugin no commit do branch `feat/redmine-7` |
| `ROTEIRO-DE-TESTE.md` | roteiro de instalação, testes automatizados e checklist de aceite |
| `exemplos/` | diagramas Mermaid de exemplo (`.mmd` / `.mermaid`) |

`plugin/` foi importado com `git subtree`, então o histórico do plugin está
preservado no repositório. Para atualizar depois de um novo commit no
repositório do plugin:

```powershell
git subtree pull --prefix=plugin <caminho-ou-url-do-repo-do-plugin> feat/redmine-7 -m "Atualiza o plugin"
```

## O que o port adiciona

- Compatibilidade com o Redmine 7 (views, assets e hooks).
- Suporte ao formato Markdown (`.md`) e às cercas ```` ```mermaid ```` dentro de
  qualquer conteúdo Markdown — issues, wiki, notícias, documentos e anexos `.md`.
- Diagramas Mermaid (`.mmd` / `.mermaid`) com a fonte recolhida; a biblioteca só é
  baixada nas páginas que têm diagrama.
- Editor de blocos (paradigma alternativo ao ONLYOFFICE, escolhido nas
  configurações globais do plugin): títulos, listas, tarefas, citações, código,
  diagramas e divisores, com menu `/`, atalhos Markdown e salvamento em Markdown
  (com conversão de ida e volta para `.docx`/`.odt`/etc.).

## Instalação

1. Copie `plugin/` para `plugins/onlyoffice_redmine` da instalação do Redmine
   (ou monte como volume).
2. Se o clone não trouxe os submódulos do plugin:

   ```powershell
   git submodule update --init --recursive
   ```

   Eles trazem as listas de formatos e os modelos de documento usados pelo
   plugin.
3. Configure o endereço do Document Server e o JWT em
   *Administração → Plugins → ONLYOFFICE*.
4. Para usar o editor de blocos, escolha o paradigma em
   *Administração → Plugins → ONLYOFFICE → Edição de texto*.

O passo a passo completo, incluindo a stack Docker de teste e os resultados
esperados de cada suíte, está em [`ROTEIRO-DE-TESTE.md`](ROTEIRO-DE-TESTE.md).
