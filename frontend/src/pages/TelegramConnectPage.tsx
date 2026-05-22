import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { redirectToGoogleAuth } from '../lib/auth'

const PENDING_TOKEN_KEY = 'pendingTelegramLinkToken'
const API_BASE          = import.meta.env.VITE_API_URL ?? ''
const BOT_USERNAME      = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? ''

type Status = 'idle' | 'linking' | 'success' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_TOKEN:      'Посилання для підключення недійсне або застаріле.',
  TOKEN_EXPIRED:      'Посилання застаріло. Повернись у Telegram і натисни «Підключити акаунт» ще раз.',
  TOKEN_ALREADY_USED: 'Цей Telegram вже підключено до облікового запису.',
  ALREADY_LINKED:     'Цей Telegram акаунт вже підключено до іншого облікового запису.',
  SERVICE_UNAVAILABLE:'Сервіс тимчасово недоступний. Спробуй через кілька хвилин.',
  NETWORK_ERROR:      'Помилка мережі. Перевір підключення та спробуй ще раз.',
}

function getErrorMessage(code: string | null): string {
  if (!code) return 'Виникла помилка під час підключення Telegram.'
  return ERROR_MESSAGES[code] ?? 'Виникла помилка під час підключення Telegram.'
}

export default function TelegramConnectPage() {
  const { isAuthenticated, isAuthLoading, token } = useAuth()

  // Read token from URL (fresh arrival) or sessionStorage (returning after auth)
  const [linkToken] = useState<string | null>(() => {
    const params  = new URLSearchParams(window.location.search)
    const fromUrl = params.get('token')
    if (fromUrl) {
      console.log('[tg-connect] token detected in URL')
      sessionStorage.setItem(PENDING_TOKEN_KEY, fromUrl)
      return fromUrl
    }
    const fromStorage = sessionStorage.getItem(PENDING_TOKEN_KEY)
    if (fromStorage) console.log('[tg-connect] token restored from sessionStorage')
    return fromStorage
  })

  const [status,    setStatus]    = useState<Status>('idle')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const hasCalledRef              = useRef(false)

  // Trigger linking once auth resolves and we have both token + user
  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !linkToken || !token) return
    if (hasCalledRef.current) return
    hasCalledRef.current = true

    setStatus('linking')
    console.log('[tg-connect] linking request sent')

    fetch(`${API_BASE}/api/integrations/telegram/link`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ linkToken }),
    })
      .then(async (res) => {
        const body = await res.json() as { ok?: boolean; code?: string }
        if (res.ok && body.ok) {
          console.log('[tg-connect] linking success')
          sessionStorage.removeItem(PENDING_TOKEN_KEY)
          setStatus('success')
        } else {
          console.warn('[tg-connect] linking failure', body.code)
          setErrorCode(body.code ?? 'UNKNOWN_ERROR')
          setStatus('error')
        }
      })
      .catch(() => {
        console.error('[tg-connect] linking failure: network error')
        setErrorCode('NETWORK_ERROR')
        setStatus('error')
      })
  }, [isAuthLoading, isAuthenticated, linkToken, token])

  // Auth is still resolving
  if (isAuthLoading) return <PageShell><Spinner /></PageShell>

  // No token at all — invalid URL
  if (!linkToken) {
    return (
      <PageShell>
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">
            Посилання недійсне
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Посилання для підключення Telegram недійсне або неповне.
            Будь ласка, повернись у Telegram і спробуй знову.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 rounded-2xl bg-gradient-to-r from-[#7B8CFF] to-[#A18BFF] text-white font-semibold text-sm shadow-lg hover:opacity-90 transition-opacity"
          >
            На головну
          </a>
        </div>
      </PageShell>
    )
  }

  // Not authenticated — show Google login
  if (!isAuthenticated) {
    return (
      <PageShell>
        <div className="text-center">
          <div className="text-5xl mb-5">✈️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">
            Підключи Telegram до Mentium
          </h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Увійди в акаунт, щоб прив'язати свій Telegram.
            Після входу ми автоматично завершимо підключення.
          </p>
          <button
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#7B8CFF] via-[#A18BFF] to-[#FFB38C] text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg hover:opacity-90 active:scale-95 transition-all"
            onClick={() => {
              const returnTo = `${window.location.pathname}${window.location.search}`
              console.log('[tg-connect] auth required, preserving returnTo:', returnTo)
              redirectToGoogleAuth(returnTo)
            }}
          >
            <GoogleIcon />
            Увійти через Google
          </button>
          <p className="mt-4 text-xs text-gray-400">
            Після входу ти будеш автоматично повернутий сюди.
          </p>
        </div>
      </PageShell>
    )
  }

  // Linking in progress or initial idle (will auto-link via useEffect)
  if (status === 'idle' || status === 'linking') {
    return (
      <PageShell>
        <div className="text-center">
          <Spinner />
          <p className="mt-4 text-sm text-gray-500">Підключаємо Telegram…</p>
        </div>
      </PageShell>
    )
  }

  // Success
  if (status === 'success') {
    return (
      <PageShell>
        <div className="text-center">
          <div className="text-5xl mb-5">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">
            Telegram підключено ✅
          </h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Тепер ти можеш повернутися в бот і налаштувати нагадування.
          </p>
          {BOT_USERNAME ? (
            <a
              href={`https://t.me/${BOT_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#229ED9] text-white font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all"
            >
              <TelegramIcon />
              Повернутися в Telegram
            </a>
          ) : (
            <p className="text-sm text-gray-500">
              Повернися в Telegram вручну.
            </p>
          )}
        </div>
      </PageShell>
    )
  }

  // Error
  return (
    <PageShell>
      <div className="text-center">
        <div className="text-4xl mb-4">❌</div>
        <h1 className="text-xl font-bold text-gray-900 mb-3">
          Не вдалося підключити
        </h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {getErrorMessage(errorCode)}
        </p>
        <div className="flex flex-col gap-3">
          {BOT_USERNAME && (
            <a
              href={`https://t.me/${BOT_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#229ED9] text-white font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all"
            >
              <TelegramIcon />
              Повернутися в Telegram
            </a>
          )}
          <a
            href="/"
            className="inline-block px-6 py-3 rounded-2xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            На головну
          </a>
        </div>
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7B8CFF]/15 to-[#A18BFF]/10 border border-[#7B8CFF]/15 flex items-center justify-center text-2xl">
            ✈️
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full bg-[#7B8CFF] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="rgba(255,255,255,0.9)"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgba(255,255,255,0.9)"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="rgba(255,255,255,0.9)"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgba(255,255,255,0.9)"/>
    </svg>
  )
}

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8.02c-.12.57-.46.71-.94.44l-2.6-1.92-1.26 1.21c-.14.14-.26.26-.52.26l.18-2.64 4.72-4.27c.2-.18-.05-.28-.32-.1L7.4 14.48 4.84 13.7c-.56-.18-.57-.56.12-.82l9.87-3.8c.47-.18.88.11.81.72z" fill="white"/>
    </svg>
  )
}
