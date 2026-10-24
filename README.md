This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Painel comercial da desenvolvedora (nova área)

A rota `/desenvolvedor` é separada do painel operacional `/admin`. A autorização da área comercial é validada no servidor com **duas verificações**: o UID precisa constar na variável de ambiente `DESENVOLVEDOR_UIDS` e o documento `usuarios/{uid}` precisa ter `perfil: "desenvolvedora"` e `ativo: true`.

### Preparação da conta exclusiva

1. Crie uma conta própria no Firebase Authentication (não reutilize a conta de enfermeira/administradora municipal).
2. Copie o UID dessa conta e crie/atualize o documento `usuarios/{UID}` no Firestore com os campos `nome`, `email`, `perfil: "desenvolvedora"` e `ativo: true`.
3. Em Vercel → Project Settings → Environment Variables, configure `DESENVOLVEDOR_UIDS` com o UID autorizado. Para múltiplas contas autorizadas, use UIDs separados por vírgula. Não use e-mail como substituto do UID.
4. Faça redeploy após salvar a variável.

### Coleções comerciais

- `assinaturas/{ubsId}`: valor mensal, vencimento, tolerância, observação e metadados de atualização.
- `pagamentosAssinaturas/{id}`: histórico de pagamentos confirmados manualmente.
- `auditoriaComercial/{id}`: registro das ações comerciais realizadas.

Essas coleções são acessadas pelo servidor via Firebase Admin SDK; as regras do Firestore já negam acesso direto ao cliente para caminhos não declarados.

**Importante:** nesta primeira etapa o painel registra configurações, pagamentos e auditoria, e calcula o status comercial considerando cinco dias de tolerância. A suspensão de acesso aos fluxos operacionais ainda não foi conectada deliberadamente; isso evita bloquear UBS por engano antes de uma rodada de testes e da validação de todas as APIs protegidas.
