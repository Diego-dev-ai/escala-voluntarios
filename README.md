# Escala de Voluntários

Aplicação mobile-first para uma equipe de 12 (ou mais) voluntários escolher rapidamente seus turnos mensais.

## O que já está implementado

- `/` página inicial
- `/escala` escala do mês corrente
- `/escala/2026-10` escala de um mês específico
- `/admin` painel protegido por PIN
- Escolha do voluntário sem cadastro
- Mínimo configurável de 2 marcações por pessoa
- Sem limite máximo de marcações
- Domingos e turnos passados desabilitados
- Contexto temporal: HOJE, próximo domingo, daqui X dias e já passou
- Cards separados por domingo
- Dois turnos por domingo
- Horário de chegada + horário do culto
- Indicador de quantidade de pessoas por turno
- Identificação de turnos vazios no painel
- Escala pode ser encerrada/reaberta pelo líder
- Equipe pode ser adicionada/desativada no painel
- Atualização em tempo real via Supabase Realtime
- Copiar a escala em texto formatado para WhatsApp
- Preparado para Vercel

## 1. Instalação local

```bash
npm install
```

Copie `.env.example` para `.env.local`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
```

Depois:

```bash
npm run dev
```

## 2. Configurar Supabase

1. Crie um projeto gratuito no Supabase.
2. Abra o SQL Editor.
3. Cole e execute todo o conteúdo de `supabase/schema.sql`.
4. No primeiro acesso ao `/admin`, o líder define o próprio PIN diretamente pela tela.
5. Cadastre os voluntários pelo painel ou pelo SQL.

### Primeiro acesso do líder

Depois que o SQL estiver instalado e o `.env` configurado, abra `/admin`.
Se ainda não existir um PIN, o sistema mostrará a tela **Configurar painel**.
O líder informa o nome da equipe (opcional) e cria um PIN numérico de pelo menos 4 dígitos.

### Observação importante sobre segurança

O requisito do projeto diz que os dados são públicos para quem possuir o link e que o grupo é fechado. Por isso, a leitura dos dados é pública e não existe conta para voluntários.

O PIN protege a interface do painel, mas as políticas de escrita do banco seguem o modelo simplificado solicitado. Para uma implantação com dados mais sensíveis, recomenda-se evoluir para autenticação real do administrador e RLS baseada em sessão.

## 3. GitHub

Crie um repositório vazio no GitHub e envie todos os arquivos deste projeto.

Com Git instalado:

```bash
git init
git add .
git commit -m "Primeira versão da escala de voluntários"
git branch -M main
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
```

Ou faça upload dos arquivos diretamente pelo GitHub, como no projeto do portfólio.

## 4. Vercel

1. Entre na Vercel.
2. Importe o repositório do GitHub.
3. Framework: Vite (a Vercel normalmente detecta automaticamente).
4. Adicione as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Publique.

Após qualquer alteração no GitHub, a Vercel fará novo deploy automaticamente.

## 5. Link para o WhatsApp

O link principal para os voluntários é:

`https://SEU-DOMINIO.com.br/escala`

O mês é calculado automaticamente no navegador.

Também é possível abrir diretamente um mês específico:

`https://SEU-DOMINIO.com.br/escala/2026-10`

## Próximas evoluções possíveis

- lembrete automático para quem ainda não respondeu
- histórico de escalas
- troca de turno com aprovação
- exportação PNG
- drag-and-drop dos voluntários
- edição do mínimo de marcações no painel
- dark mode
- geração de PDF
