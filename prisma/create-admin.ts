// 運営アカウントを作る（または、すでにある運営アカウントのパスワードを変える）。
// パスワードは画面に表示せず、ログにも残さない。使い方：npm run admin:create
import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // 入力した文字を画面に出さない
      const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
      out._writeToOutput = (s: string) => {
        if (s.startsWith(question)) out.output.write(question);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const prisma = new PrismaClient();

async function main() {
  const email = (await ask('運営アカウントのメールアドレス: ')).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('メールアドレスの形が正しくありません。');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'ADMIN') {
    throw new Error('このメールアドレスは旅行者または事業者のアカウントで使われています。別のメールアドレスを使ってください。');
  }
  const pw = await ask('パスワード（12文字以上。入力しても表示されません）: ', true);
  if (pw.length < 12) throw new Error('パスワードは12文字以上にしてください。');
  const again = await ask('もう一度パスワード: ', true);
  if (pw !== again) throw new Error('パスワードが一致しません。');
  const passwordHash = await bcrypt.hash(pw, 10);
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
    // 古いログイン状態はすべて無効にする
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    console.log('運営アカウントのパスワードを変えました。');
  } else {
    await prisma.user.create({ data: { email, passwordHash, role: 'ADMIN', name: '運営', lang: 'ja', currency: 'JPY', privacyConsentAt: new Date() } });
    console.log('運営アカウントを作りました。https://haisailocal.vercel.app/admin からログインできます。');
  }
}

main()
  .catch((e) => {
    console.error('できませんでした：', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
