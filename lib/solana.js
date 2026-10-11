import { createHash } from 'node:crypto';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';

const DEVNET = 'https://api.devnet.solana.com';
const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const PREFIX = 'tradewinds:';

let connection = null;
function devnet() {
  if (!connection) connection = new Connection(DEVNET, 'confirmed');
  return connection;
}

function wallet() {
  const key = process.env.SOLANA_SECRET_KEY;
  return key ? Keypair.fromSecretKey(Buffer.from(key, 'base64')) : null;
}

export function hasWallet() {
  return Boolean(process.env.SOLANA_SECRET_KEY);
}

export function fingerprint({ observation, summary, ideas }) {
  const parts = [observation, summary, (ideas || []).map((idea) => [idea.ticker, idea.direction])];
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export async function stamp(hash) {
  const payer = wallet();
  if (!payer) throw new Error('No Solana wallet is set.');
  const memo = new TransactionInstruction({
    programId: MEMO_PROGRAM,
    keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
    data: Buffer.from(`${PREFIX}${hash}`, 'utf8'),
  });
  return sendAndConfirmTransaction(devnet(), new Transaction().add(memo), [payer], { commitment: 'confirmed' });
}

export async function readStamp(signature) {
  const tx = await devnet().getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  if (!tx) return null;
  const line = (tx.meta?.logMessages || []).find((log) => log.includes(PREFIX));
  const hash = line?.match(/tradewinds:([0-9a-f]{64})/)?.[1] || null;
  return { hash, time: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null };
}

export function explorerLink(signature) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export async function stampsLeft() {
  const payer = wallet();
  if (!payer) return 0;
  return Math.floor((await devnet().getBalance(payer.publicKey)) / 5000);
}

export function walletAddress() {
  return wallet()?.publicKey.toBase58() || null;
}
