# RabbitMQ STOMP WebSocket 클라이언트 연결 가이드

## 개요

ExpertLink 서버는 RabbitMQ STOMP WebSocket을 통한 실시간 채팅을 지원합니다. 
Socket.IO 대신 순수 RabbitMQ STOMP 프로토콜을 사용하여 더 표준화된 메시징을 제공합니다.

## 연결 정보

- **STOMP WebSocket URL**: `ws://localhost:15674/ws`
- **인증**: RabbitMQ 기본 인증 (guest/guest)
- **Virtual Host**: `/` (기본값)

## 연결 순서

### 1. 연결 정보 요청 (HTTP API)

먼저 NestJS 서버에 연결 정보를 요청합니다:

```javascript
POST http://localhost:5700/chat-ws/connect
Headers: {
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
```

**응답 예시:**
```json
{
  "status": "success",
  "connectionInfo": {
    "stompUrl": "ws://localhost:15674/ws",
    "username": "guest",
    "password": "guest",
    "vhost": "/"
  },
  "subscriptions": [
    {
      "destination": "/exchange/chat.direct/room.1",
      "roomId": 1,
      "roomName": "상담방 #1"
    }
  ],
  "userInfo": {
    "userId": 123,
    "email": "user@example.com",
    "userType": "user"
  }
}
```

### 2. STOMP WebSocket 연결

#### JavaScript (웹 브라우저)

```javascript
// STOMP.js 라이브러리 사용
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const stompClient = new Client({
  brokerURL: 'ws://localhost:15674/ws',
  connectHeaders: {
    login: 'guest',
    passcode: 'guest',
    'host': '/'
  },
  debug: function (str) {
    console.log('STOMP: ' + str);
  },
  reconnectDelay: 5000,
  heartbeatIncoming: 4000,
  heartbeatOutgoing: 4000,
});

// 연결 성공
stompClient.onConnect = function (frame) {
  console.log('STOMP 연결 성공:', frame);
  
  // 채팅방 구독
  stompClient.subscribe('/exchange/chat.direct/room.1', function (message) {
    const data = JSON.parse(message.body);
    console.log('채팅 메시지 수신:', data);
    handleChatMessage(data);
  });
  
  // 개인 메시지 구독
  stompClient.subscribe('/exchange/chat.direct/user.123', function (message) {
    const data = JSON.parse(message.body);
    console.log('개인 메시지 수신:', data);
    handlePersonalMessage(data);
  });
};

// 연결 에러
stompClient.onStompError = function (frame) {
  console.error('STOMP 에러:', frame.headers['message']);
  console.error('상세 정보:', frame.body);
};

// 연결 시작
stompClient.activate();
```

#### React Native

```javascript
import { Client } from '@stomp/stompjs';

const connectToChat = async (connectionInfo) => {
  const client = new Client({
    brokerURL: connectionInfo.stompUrl,
    connectHeaders: {
      login: connectionInfo.username,
      passcode: connectionInfo.password,
      'host': connectionInfo.vhost
    },
    onConnect: (frame) => {
      console.log('STOMP 연결됨');
      
      // 채팅방들 구독
      connectionInfo.subscriptions.forEach(sub => {
        client.subscribe(sub.destination, (message) => {
          const data = JSON.parse(message.body);
          onMessageReceived(data, sub.roomId);
        });
      });
    },
    onStompError: (frame) => {
      console.error('STOMP 에러:', frame);
    }
  });
  
  client.activate();
  return client;
};
```

### 3. 채팅 기능 사용

#### 메시지 전송 (HTTP API)

```javascript
// 메시지 전송
const sendMessage = async (roomId, content) => {
  const response = await fetch('http://localhost:5700/chat-ws/send-message', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + jwtToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      roomId: roomId,
      message: {
        message_type: 'text',
        content: content
      }
    })
  });
  
  const result = await response.json();
  console.log('메시지 전송 결과:', result);
};
```

#### 타이핑 상태 전송

```javascript
// 타이핑 시작
const startTyping = async (roomId) => {
  await fetch('http://localhost:5700/chat-ws/typing-start', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + jwtToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ roomId })
  });
};

// 타이핑 종료
const endTyping = async (roomId) => {
  await fetch('http://localhost:5700/chat-ws/typing-end', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + jwtToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ roomId })
  });
};
```

#### 방 참여/나가기

```javascript
// 방 참여
const joinRoom = async (roomId) => {
  const response = await fetch('http://localhost:5700/chat-ws/join-room', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + jwtToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ roomId })
  });
  
  const result = await response.json();
  
  // 성공하면 해당 방 구독
  if (result.status === 'joined') {
    stompClient.subscribe(result.subscription, (message) => {
      const data = JSON.parse(message.body);
      handleRoomMessage(data, roomId);
    });
  }
};

// 방 나가기
const leaveRoom = async (roomId) => {
  await fetch(`http://localhost:5700/chat-ws/leave-room/${roomId}`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + jwtToken
    }
  });
};
```

## 수신 메시지 타입

STOMP 구독을 통해 받는 메시지의 종류:

### 채팅 메시지
```json
{
  "type": "new_message",
  "message": {
    "id": 123,
    "content": "안녕하세요",
    "message_type": "text",
    "sender_id": 456,
    "created_at": "2024-01-01T12:00:00Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 사용자 상태 변경
```json
{
  "type": "user_status_changed",
  "userId": 456,
  "status": "online",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 타이핑 상태
```json
{
  "type": "user_typing",
  "userId": 456,
  "isTyping": true,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 메시지 읽음 상태
```json
{
  "type": "message_read",
  "messageId": 123,
  "readerId": 456,
  "readAt": "2024-01-01T12:00:00.000Z"
}
```

## 연결 해제

```javascript
// 앱 종료 시 연결 정리
const disconnectChat = async () => {
  // 1. 서버에 연결 해제 알림
  await fetch('${SERVER_BASE_URL}/chat-ws/disconnect', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + jwtToken
    }
  });
  
  // 2. STOMP 연결 해제
  if (stompClient && stompClient.connected) {
    stompClient.deactivate();
  }
};
```

## 에러 처리

```javascript
// 재연결 로직
stompClient.onWebSocketError = function (event) {
  console.error('WebSocket 에러:', event);
};

stompClient.onWebSocketClose = function (event) {
  console.log('WebSocket 연결 종료:', event);
  // 자동 재연결은 STOMP 클라이언트가 처리
};

// 메시지 전송 실패 처리
const sendMessageWithRetry = async (roomId, content, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await sendMessage(roomId, content);
      break;
    } catch (error) {
      console.error(`메시지 전송 실패 (${i + 1}/${retries}):`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

## 필요한 라이브러리

### 웹 (JavaScript/TypeScript)
```bash
npm install @stomp/stompjs
```

### React Native
```bash
npm install @stomp/stompjs react-native-url-polyfill
```

### Flutter
```yaml
dependencies:
  stomp_dart_client: ^0.4.4
```

이 가이드를 따르면 RabbitMQ STOMP를 통해 안정적이고 확장 가능한 실시간 채팅 시스템을 구현할 수 있습니다.