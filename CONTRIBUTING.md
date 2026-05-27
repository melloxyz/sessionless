<div align="center">

# Contribuindo para o Sessionless

Obrigado por considerar contribuir com o Sessionless!

</div>

---

## Sumário

- [Como Contribuir](#como-contribuir)
- [Guia de Desenvolvimento](#guia-de-desenvolvimento)
- [Adicionando um Novo Adapter de CLI](#adicionando-um-novo-adapter-de-cli)
- [Regras de Engenharia](#regras-de-engenharia)
- [Estilo de Código](#estilo-de-código)
- [Commits](#commits)
- [Pull Requests](#pull-requests)
- [Issues](#issues)
- [Licença](#licença)

---

## Como Contribuir

1. Faça **fork** do repositório
2. Crie uma **branch** para sua feature (`git checkout -b feat/nome-da-feature`)
3. Faça **commit** das suas mudanças
4. **Push** para a branch (`git push origin feat/nome-da-feature`)
5. Abra um **Pull Request**

---

## Guia de Desenvolvimento

### Pré-requisitos

- [Node.js](https://nodejs.org) >= 20
- [pnpm](https://pnpm.io) >= 9 (`npm install -g pnpm`)

### Setup

```bash
git clone https://github.com/melloxyz/sessionless.git
cd sessionless
pnpm install
pnpm dev
```

### Comandos Disponíveis

| Comando | Descrição |
|---|---|
| `pnpm dev` | Stack completo (backend + frontend) |
| `pnpm typecheck` | Typecheck em todos os packages |
| `pnpm lint` | Lint em todos os packages |
| `pnpm build` | Build de produção |
| `pnpm --filter @sessionless/backend dev` | Apenas backend |
| `pnpm --filter @sessionless/frontend dev` | Apenas frontend |
| `pnpm --filter @sessionless/frontend build` | Build do frontend |

---

## Adicionando um Novo Adapter de CLI

### 1. Criar o adapter

Crie o arquivo `packages/backend/src/adapters/nome.ts` e implemente a interface `Adapter`:

```typescript
import type { Adapter, Checkpoint, RawSession } from './types.js';
import type { CliProvider } from '@sessionless/shared';

export function createNomeAdapter(): Adapter {
  return {
    cli: 'nome' as CliProvider,

    async detect(): Promise<boolean> {
      // Verificar se a CLI está instalada / dados existem
    },

    async discover(): Promise<string[]> {
      // Retornar lista de paths de sessões para processar
    },

    async computeCheckpoint(sessionPath: string): Promise<Checkpoint | null> {
      // Retornar checkpoint para incremental parsing
    },

    async parse(sessionPath: string, checkpoint: Checkpoint | null): Promise<RawSession[]> {
      // Parsear dados brutos em RawSession[]
    },

    normalize(raw: RawSession): RawSession {
      // Normalizar provider/model se necessário
      return raw;
    },

    async watchPaths(): Promise<string[]> {
      // Retornar diretórios para filesystem watcher
      return [];
    },
  };
}
```

### 2. Registrar o adapter

Em `packages/backend/src/adapters/index.ts`:

```typescript
export { createNomeAdapter } from './nome.js';
```

Em `packages/backend/src/index.ts`, adicionar ao registry:

```typescript
import { createNomeAdapter } from './adapters/index.js';
// ...
registry.register(createNomeAdapter());
```

### 3. Adicionar o provider

Em `packages/shared/src/types.ts`, adicionar ao `CliProvider`:

```typescript
export type CliProvider = 'claude' | 'opencode' | 'codex' | 'gemini' | 'kimi' | 'aider' | 'qwen' | 'antigravity' | 'nome';
```

### 4. Migration (se necessário)

Se precisar de novas colunas ou tabelas:

1. Criar `packages/backend/src/db/migrations/NNNN_descricao.sql`
2. Registrar em `packages/backend/src/db/migrate.ts` no array `migrations`
3. **Nunca** editar uma migration já aplicada

### 5. Testar

```bash
pnpm typecheck
pnpm --filter @sessionless/backend dev
```

Verificar se `/api/integrations/status` mostra a nova CLI.

---

## Regras de Engenharia

| Regra | Descrição |
|---|---|
| **Local-first** | Nenhuma dependência de cloud. Tudo roda offline. |
| **No terminal scraping** | Nada de regex em stdout, pseudo-terminais ou interceptação. |
| **Adapter isolation** | Cada CLI tem seu adapter isolado. Mudanças internas não quebram outras. |
| **Incremental parsing** | Sempre usar checkpoint/hash para evitar re-leitura de dados já ingeridos. |
| **Sem autenticação no MVP** | Zero login, single-user local. |
| **Nunca editar migration aplicada** | Criar novo arquivo e registrar em `migrate.ts`. |
| **Manter estilo do projeto** | NodeNext modules, `.js` extensions em imports, Tailwind v4. |

---

## Estilo de Código

- **TypeScript:** Strict mode, `moduleResolution: NodeNext`
- **Imports:** Sempre com extensão `.js` em imports relativos
- **Formato:** Prettier com configuração do projeto
- **Naming:** `camelCase` para variáveis/funções, `PascalCase` para componentes/types
- **CSS:** Tailwind v4, seguir design system existente
- **Frontend:** Usar componentes existentes em `packages/frontend/src/components/ui/`

---

## Commits

Use mensagens descritivas em inglês seguindo o formato:

```
tipo(escopo): descrição
```

### Tipos

| Tipo | Descrição |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Documentação |
| `style` | Formatação (sem mudança de lógica) |
| `refactor` | Refatoração sem mudança de comportamento |
| `test` | Adição/correção de testes |
| `chore` | Configurações, dependências, tooling |

### Exemplos

```
feat(adapters): add new CLI adapter for Gemini
fix(ingestion): resolve cost calculation edge case
docs(readme): update contributing section
chore(deps): update fastify to v5
```

---

## Pull Requests

- Uma feature/fix por PR
- Descreva o que mudou e por quê
- Inclua screenshots se houver mudança visual
- Certifique-se que `pnpm typecheck` passa
- Peça review para pelo menos uma pessoa

### Template de PR

```markdown
## O que mudou

Descrição breve das mudanças.

## Por quê

Motivo da mudança.

## Como testar

1. Passo 1
2. Passo 2
3. Passo 3

## Screenshots (se aplicável)

[Colar prints aqui]
```

---

## Issues

- Use templates existentes quando disponíveis
- Inclua: versão do Node, SO, passos para reproduzir
- Labels: `bug`, `feature`, `documentation`, `good first issue`

---

## Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a [MIT License](LICENSE).
