# Roadmap — Perfis de utilizador (visão completa)

O MVP atual entrega a base estilo Steam adaptada ao trabalho: página visitável, personalização (avatar, fundo, cor, tema, bio, cargo) e atividade recente.

Este documento descreve o que **não** está no MVP e pode ser construído depois, por fases.

## Fase 2 — Progressão e reconhecimento

- **Nível / XP** derivado de `logs_atividade` (ex.: criar publicação = 10 XP, editar módulo = 5 XP).
- **Badges** atribuídos por marcos (primeira publicação, 10 módulos, 30 dias ativos).
- **Showcases** no perfil: até 3 badges ou módulos em destaque (como Steam showcases).
- **Molduras de avatar** (cosméticos desbloqueáveis ou atribuídos por admin).

## Fase 3 — Presença e contexto

- **Status online** / “visto há X minutos” (heartbeat leve ou last_seen em `profiles`).
- **Estado contextual**: “A editar módulo Y”, “Em Separador de PDF”.
- **Lista de amigos / equipa** (favoritos entre colegas) com atalho para perfis.

## Fase 4 — Inventário e conteúdo pessoal

- **Inventário**: conquistas, certificados internos, links favoritos.
- **Recentes no trabalho**: últimos módulos/publicações tocados (além do log genérico).
- **Reviews internas** curtas sobre processos/módulos (opcional, moderado).
- **Temas pré-definidos** (paletas + fundos da biblioteca OPTO), além do upload livre.

## Fase 5 — Social leve e privacidade

- **Mural / comentários** no perfil (equipa autenticada).
- **Privacidade granular**: esconder e-mail, esconder certos tipos de log, perfil “só eu”.
- **Notificações** quando alguém visita ou comenta (opcional).

## Notas técnicas para o futuro

- Manter `perfil.html?id=<uuid>` como URL canónica.
- Preferir tabelas novas (`perfil_badges`, `perfil_showcases`, `perfil_presenca`) em vez de JSON opaco em `profiles`.
- XP/nível: calcular em view SQL ou job periódico; não recalcular no client a cada visita.
- Qualquer leitura social continua a exigir utilizador autenticado e ativo (hub interno).

## Fora de intenção (por agora)

- Perfis públicos na internet sem login.
- Marketplace de cosméticos pagos.
- Chat em tempo real embutido no perfil.
