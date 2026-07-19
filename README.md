# Discord GPT Bot

OpenAI Responses API를 사용하는 범용 Discord 대화 봇입니다. 서버에서는 봇을 태그하거나 `gpt`가 포함된 메시지로, DM에서는 바로 대화할 수 있습니다.

## 주요 기능

- 모델, 최대 출력 토큰, 시스템 프롬프트 등 `.env` 설정
- 봇 태그 또는 대소문자 구분 없이 `gpt`가 포함된 메시지에 응답
- SQLite에 영구 저장되는 사용자·채널별 대화와 `reset` 명령
- 이미지 첨부 입력
- Discord 2,000자 제한에 맞춘 자동 분할
- 동일 대화의 요청 순서 보장, 사용자 쿨다운, API 재시도/타임아웃
- 메시지 수, TTL 및 최대 대화 수에 따른 SQLite 자동 정리

## 준비

Node.js 20 이상이 필요합니다.

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 애플리케이션과 Bot을 생성합니다.
2. Bot 페이지에서 **Message Content Intent**를 활성화합니다.
3. OAuth2 URL Generator에서 `bot` scope와 `View Channels`, `Send Messages`, `Read Message History` 권한을 선택해 서버에 초대합니다.
4. 프로젝트의 `.env`에서 아래 필수값을 채웁니다.

```dotenv
DISCORD_TOKEN=Discord Bot 토큰
OPENAI_API_KEY=OpenAI API 키
OPENAI_MODEL=사용할 OpenAI 모델 ID
```

`OPENAI_API_KEY`는 ChatGPT 구독과 별개인 OpenAI API 키입니다. 비밀값이 든 `.env`는 Git에서 제외됩니다.

## 실행

```bash
pnpm install
pnpm start
```

개발 중에는 `pnpm dev`, 테스트와 문법 검사는 `pnpm check`를 사용합니다.

## PM2로 운영

PM2가 프로젝트 의존성에 포함되어 있으므로 별도로 전역 설치할 필요가 없습니다.

```bash
pnpm pm2:start
pnpm pm2:logs
```

설정 변경 후 재시작하거나 프로세스를 중지·삭제할 때는 다음 명령을 사용합니다.

```bash
pnpm pm2:restart
pnpm pm2:stop
pnpm pm2:delete
```

서버 재부팅 후 자동 실행이 필요하면 운영체제에 맞게 `pnpm exec pm2 startup`을 실행하고, 안내되는 관리자 명령을 수행한 뒤 `pnpm exec pm2 save`를 실행하세요.

SQLite 파일과 대화별 처리 순서를 안전하게 유지하기 위해 [ecosystem.config.cjs](./ecosystem.config.cjs)는 단일 인스턴스 `fork` 모드로 설정되어 있습니다.

## 사용법

- `@봇이름 질문 내용`
- `gpt 질문 내용`, `GPT 질문 내용`
- `@봇이름 reset` 또는 `@봇이름 new`: 현재 대화 기록 초기화
- `@봇이름 help`: 도움말
- DM: 접두사 없이 바로 질문

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---:|---|
| `DISCORD_TOKEN` | 필수 | Discord Bot 토큰 |
| `OPENAI_API_KEY` | 필수 | OpenAI API 키 |
| `OPENAI_MODEL` | 필수 | Responses API를 지원하는 모델 ID |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API 기준 URL |
| `MAX_OUTPUT_TOKENS` | `2048` | 한 응답의 최대 출력 토큰 |
| `OPENAI_REASONING_EFFORT` | 설정 안 함 | 모델의 reasoning 강도 (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`) |
| `SYSTEM_PROMPT` | 영문 기본 프롬프트 | 봇의 역할/답변 규칙 |
| `OPENAI_TIMEOUT_MS` | `120000` | API 요청 제한 시간(ms) |
| `OPENAI_MAX_RETRIES` | `2` | 일시적 오류 재시도 횟수 |
| `REPLY_MODE` | `both` | `mention`, `detect`, `both`, `all` 중 하나 |
| `CONVERSATION_SCOPE` | `channel-user` | `channel`, `user`, `channel-user` 중 하나 |
| `MAX_HISTORY_MESSAGES` | `20` | API에 전달할 최근 메시지 수 (`0`은 기억 안 함) |
| `MAX_CONVERSATIONS` | `500` | 메모리에 보관할 최대 대화 수 |
| `CONVERSATION_TTL_MINUTES` | `60` | 비활성 대화 만료 시간(분) |
| `SQLITE_PATH` | `./data/conversations.db` | 대화 SQLite 데이터베이스 경로 |
| `USER_COOLDOWN_MS` | `1000` | 사용자별 요청 간격(ms) |
| `MAX_INPUT_CHARS` | `12000` | 한 번에 받을 최대 글자 수 |

`mention`은 태그, `detect`는 대소문자 구분 없는 `gpt` 포함 여부, `both`는 두 방식 모두를 뜻합니다. 설정을 바꾸면 봇을 재시작해야 합니다. `REPLY_MODE=all`은 서버의 모든 일반 메시지에 응답하므로 전용 채널에서만 사용하세요.

## 운영 참고

- 대화 기록은 SQLite에 저장되어 재시작 후에도 유지됩니다.
- 최근 메시지 수, 비활성 TTL, 최대 대화 수를 초과한 기록은 자동 삭제되어 무한히 쌓이지 않습니다.
- 여러 봇 인스턴스가 동시에 같은 DB 파일을 공유해야 한다면 Redis나 서버형 DB를 사용하세요.
- API 오류의 상세 내용은 Discord에 노출하지 않고 서버 콘솔에만 기록합니다.
