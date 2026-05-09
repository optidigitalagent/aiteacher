import crypto from 'crypto'

const PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY ?? ''
const PUBLIC_KEY  = process.env.LIQPAY_PUBLIC_KEY  ?? ''

function sha1Base64(input: string): string {
  return crypto.createHash('sha1').update(input).digest('base64')
}

export function buildSignature(data: string): string {
  return sha1Base64(PRIVATE_KEY + data + PRIVATE_KEY)
}

export function verifySignature(data: string, signature: string): boolean {
  return buildSignature(data) === signature
}

export function encodeData(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export function decodeData(data: string): Record<string, unknown> {
  const json = Buffer.from(data, 'base64').toString('utf-8')
  return JSON.parse(json) as Record<string, unknown>
}

export interface CheckoutParams {
  orderId:     string
  amount:      number
  currency:    string
  description: string
  resultUrl:   string
  serverUrl:   string
  sandbox:     boolean
}

export function buildCheckout(params: CheckoutParams): { data: string; signature: string } {
  const payload: Record<string, unknown> = {
    version:     3,
    public_key:  PUBLIC_KEY,
    action:      'pay',
    amount:      params.amount,
    currency:    params.currency,
    description: params.description,
    order_id:    params.orderId,
    result_url:  params.resultUrl,
    server_url:  params.serverUrl,
  }
  if (params.sandbox) payload['sandbox'] = 1

  const data      = encodeData(payload)
  const signature = buildSignature(data)
  return { data, signature }
}
