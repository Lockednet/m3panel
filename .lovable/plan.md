# Painel IPTV (estilo Sigma) — Gerenciador de listas M3U e conexões

Um painel completo onde você importa uma lista M3U (por URL ou upload), o sistema analisa e organiza tudo em canais, filmes e séries, e você cria usuários/testes que se conectam pelos aplicativos player usando o DNS do painel — não mais a URL da lista original.

## O que será construído

### 1. Backend e contas (Lovable Cloud)
- Login de administrador e revendedores.
- Admin cria revendedores (com créditos); revendedor cria clientes e vê apenas os seus.
- Toda a base fica protegida por regras de acesso por dono/papel.

### 2. Importação e análise da lista
- Importar por URL M3U ou upload de arquivo `.m3u`.
- Processamento em segundo plano com barra de progresso (listas grandes, sem tamanho fixo).
- Detecção automática do tipo de item: canal ao vivo, filme (VOD) ou série (com temporada/episódio pelo nome).
- Categorias criadas a partir do `group-title` da própria lista.
- Capa (`tvg-logo`), nome, EPG id e URL de origem guardados por item.
- Reimportar/sincronizar a lista: atualiza itens, marca removidos.

### 3. Dashboard
- Totais: canais, filmes, séries (e episódios), categorias.
- Usuários ativos, testes ativos, testes expirados, total de conexões.
- Online agora (quantas sessões ativas), com atualização automática.
- Últimas importações e status.

### 4. Abas de categorias e conteúdo
- Abas separadas: Canais / Filmes / Séries.
- Lista de categorias vindas da lista, com contagem de itens.
- Conteúdo com capa, nome, categoria e URL; busca, filtro e paginação.
- Editar (nome, capa, categoria, URL), ocultar e apagar itens ou categorias inteiras.

### 5. Usuários / conexões (o coração do painel)
- Criar usuário: login, senha, validade, nº máximo de conexões simultâneas, pacote de categorias liberadas.
- Criar teste rápido (ex.: 1h / 6h / 24h) com geração automática de credenciais.
- Ações: renovar, bloquear, desbloquear, apagar, resetar conexões.
- Ver status: ativo, expirado, bloqueado, online/offline, IP e player usado, último acesso.
- Histórico de conexões por usuário.

### 6. Entrega para os players (API Xtream no DNS do painel)
- Endpoints compatíveis com aplicativos IPTV:
  - `player_api.php` — autenticação, categorias, canais, VOD, séries, info do usuário.
  - `get.php` — geração da M3U personalizada do usuário.
  - `xmltv.php` — EPG (quando a lista fornecer).
  - Rota de streaming `/live/{user}/{pass}/{id}` que valida credenciais, validade, limite de conexões e redireciona para a URL de origem — o cliente nunca vê a lista original.
- Cada acesso registra sessão (para o "online") e é encerrado por expiração/limite.

## Detalhes técnicos

- TanStack Start + Lovable Cloud (Postgres, auth, storage).
- Tabelas: `profiles`, `user_roles` (tabela separada, com função `has_role`), `resellers`/créditos, `playlists`, `import_jobs`, `categories`, `channels`, `movies`, `series`, `series_episodes`, `line_users` (conexões), `line_sessions`, `packages` (bouquets).
- Parser M3U em server function com processamento em lotes (chunks) e inserção em massa, para aguentar listas grandes; job com status e progresso.
- Endpoints Xtream em rotas de servidor sob `src/routes/api/public/*` (players externos não passam pela autenticação do site) — cada handler valida usuário/senha, validade e limite de conexões por conta própria.
- Índices por playlist/categoria e paginação no servidor para navegar listas grandes sem travar.
- Senha das linhas armazenada com hash; URLs de origem nunca expostas ao cliente final.

## Ordem de entrega

1. Base: auth (admin/revendedor), papéis, layout do painel.
2. Importação M3U (URL + upload) + parser + categorias/conteúdo no banco.
3. Dashboard com métricas reais.
4. Abas Canais / Filmes / Séries com edição e exclusão.
5. Usuários, testes, pacotes e controle de conexões.
6. API Xtream (player_api, get.php, streaming) + monitor de online.
7. Revendedores com créditos e limites.

## Observações

- O DNS personalizado do painel é configurado depois via domínio próprio; os endpoints já funcionam na URL do projeto.
- O painel só redireciona o stream para a origem (não faz transcodificação nem restream, que exigiriam servidor de mídia dedicado).
