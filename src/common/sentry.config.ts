// Sentry 설정 - 의존성 설치 후 활성화
export function initSentry() {
  const environment = process.env.NODE_ENV || 'development';
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('⚠️ Sentry DSN이 설정되지 않았습니다. 모니터링이 비활성화됩니다.');
    return;
  }

  try {
    // Sentry 모듈이 설치되어 있지 않으면 건너뛰기
    const Sentry = require('@sentry/node');
    
    Sentry.init({
      dsn,
      environment,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
      ],
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      beforeSend(event: any, hint: any) {
        const error = hint.originalException;
        
        if (environment === 'development') {
          return event;
        }
        
        if (error instanceof Error) {
          if (error.message?.includes('Cannot GET') || error.message?.includes('Not Found')) {
            return null;
          }
          
          if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
            event.level = 'info';
          }
        }
        
        return event;
      },
      initialScope: {
        tags: {
          component: 'expertlink-server',
          version: '1.0.0',
        },
        contexts: {
          runtime: {
            name: 'node',
            version: process.version,
          },
        },
      },
    });

    console.log(`✅ Sentry 모니터링이 활성화되었습니다 (${environment})`);
  } catch (error) {
    console.log('ℹ️ Sentry 모듈이 설치되지 않았습니다. 모니터링이 비활성화됩니다.');
    console.log('   설치 명령어: npm install @sentry/node @sentry/profiling-node');
  }
}